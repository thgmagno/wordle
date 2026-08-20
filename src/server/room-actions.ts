"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { createRound } from "@/server/game-actions";
import { emitRoomUpdate } from "@/lib/realtime";
import { generateRoomCode, normalizeRoomCode } from "@/lib/room-code";

/**
 * Create a new game room.
 * The host is always the currently authenticated user — never a
 * client-supplied id, to prevent creating rooms in someone else's name.
 */
export async function createRoom(
  wordLength: number
): Promise<{ success: boolean; roomId?: string; error?: string }> {
  const session = await auth();
  const hostId = session?.user?.id;

  if (!hostId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    if (![4, 5, 6].includes(wordLength)) {
      return { success: false, error: "O comprimento da palavra deve ser 4, 5 ou 6" };
    }

    // Check rate limit for room creation
    const rateLimit = await checkRateLimit(
      `create-room-${hostId}`,
      RATE_LIMIT_CONFIGS.ROOM_CREATION
    );

    if (!rateLimit.allowed) {
      logger.warn("room", "Room creation rate limit exceeded", { userId: hostId }, hostId);
      return { success: false, error: rateLimit.message || "Limite de criação de salas atingido" };
    }

    // Create room. Room.code (the short, human-typeable public identifier —
    // see the schema comment) has its own unique constraint; a collision
    // is astronomically unlikely at 31^6 possible codes, but retrying a
    // few times turns that near-impossible case into a clean success
    // instead of a confusing user-facing failure.
    let room: Awaited<ReturnType<typeof prisma.room.create>> | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        room = await prisma.room.create({
          data: {
            code: generateRoomCode(),
            hostId,
            wordLength,
            status: "LOBBY",
            maxPlayers: 10,
          },
        });
        break;
      } catch (err) {
        const isCodeCollision = (err as { code?: string } | null)?.code === "P2002";
        if (isCodeCollision && attempt < 4) {
          continue;
        }
        throw err;
      }
    }

    if (!room) {
      throw new Error("Falha ao gerar um código de sala único");
    }

    // Add host as participant
    await prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        userId: hostId,
        status: "ACTIVE",
      },
    });

    logger.info("room", "Sala criada", { roomId: room.id, code: room.code, hostId, wordLength }, hostId);
    revalidatePath("/");
    return { success: true, roomId: room.code };
  } catch (error) {
    logger.error("room", "Erro ao criar sala", error as Error, { hostId }, hostId);
    return { success: false, error: "Falha ao criar sala" };
  }
}

/**
 * Join a room.
 * The joining user is always the currently authenticated user — never a
 * client-supplied id, to prevent adding/removing arbitrary participants.
 */
export async function joinRoom(
  roomCode: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    if (!roomCode) {
      return { success: false, error: "Código da sala é obrigatório" };
    }

    // Check if room exists and is in LOBBY status. Only ACTIVE participants
    // count toward capacity — a room that has had cumulative join/leave
    // churn shouldn't reject new players just because old LEFT rows still
    // exist (getRoomInfo already filters the same way for display).
    const room = await prisma.room.findUnique({
      where: { code: normalizeRoomCode(roomCode) },
      include: { participants: { where: { status: "ACTIVE" } } },
    });

    if (!room) {
      return { success: false, error: "Sala não encontrada" };
    }

    if (room.status !== "LOBBY") {
      return { success: false, error: "A sala não está aceitando novos jogadores" };
    }

    if (room.participants.length >= room.maxPlayers) {
      return { success: false, error: "A sala está cheia" };
    }

    // Every RoomParticipant/SubmittedWord row keys on the room's real
    // ObjectId, never its public code — see the schema comment on
    // Room.code for why.
    const roomId = room.id;

    // Check if user is already in room
    const existingParticipant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (existingParticipant && existingParticipant.status === "ACTIVE") {
      return { success: true }; // Already in room
    }

    // Add user to room
    if (existingParticipant) {
      // Update status if was previously left
      await prisma.roomParticipant.update({
        where: { id: existingParticipant.id },
        data: { status: "ACTIVE", leftAt: null },
      });
    } else {
      await prisma.roomParticipant.create({
        data: {
          roomId,
          userId,
          status: "ACTIVE",
        },
      });
    }

    logger.info("room", "Usuário entrou na sala", { userId, roomId, code: room.code, participantCount: room.participants.length + 1 }, userId);
    // No revalidatePath here: unlike the other actions in this file,
    // joinRoom is called directly from RoomPage's Server Component render
    // (auto-join for a visitor opening the room link) rather than from a
    // client-triggered Server Action — and revalidatePath/revalidateTag
    // throw when called during render. The current request already gets
    // fresh data because RoomPage re-fetches getRoomInfo right after this
    // call; other clients are updated via the websocket emit below.
    // Broadcasts using the public code — every client (including this
    // same one, via RoomLobbyClient/useRoomRealtime) subscribes to its
    // socket channel by that same code, never the internal id.
    emitRoomUpdate(room.code);
    return { success: true };
  } catch (error) {
    logger.error("room", "Erro ao entrar na sala", error as Error, { roomCode }, userId);
    return { success: false, error: "Falha ao entrar na sala" };
  }
}

/**
 * Leave a room.
 * The leaving user is always the currently authenticated user — never a
 * client-supplied id.
 */
export async function leaveRoom(
  roomCode: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    const room = await prisma.room.findUnique({
      where: { code: normalizeRoomCode(roomCode) },
    });

    if (!room) {
      return { success: false, error: "Sala não encontrada" };
    }

    const roomId = room.id;

    const participant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (!participant) {
      return { success: false, error: "Usuário não está na sala" };
    }

    // Update participant status
    await prisma.roomParticipant.update({
      where: { id: participant.id },
      data: {
        status: "LEFT",
        leftAt: new Date(),
      },
    });

    // If host left, assign new host
    if (room.hostId === userId) {
      const remainingParticipants = await prisma.roomParticipant.findFirst({
        where: {
          roomId,
          status: "ACTIVE",
          userId: { not: userId },
        },
      });

      if (remainingParticipants) {
        await prisma.room.update({
          where: { id: roomId },
          data: { hostId: remainingParticipants.userId },
        });
        logger.info("room", "Anfitrião trocado", { oldHostId: userId, newHostId: remainingParticipants.userId, roomId }, userId);
      }
    }

    logger.info("room", "Usuário saiu da sala", { userId, roomId, code: room.code }, userId);
    revalidatePath(`/room/${room.code}`);
    emitRoomUpdate(room.code);
    return { success: true };
  } catch (error) {
    logger.error("room", "Erro ao sair da sala", error as Error, { userId, roomCode }, userId);
    return { success: false, error: "Falha ao sair da sala" };
  }
}

/**
 * Get room info.
 * Only the fields the lobby UI actually needs are selected — in
 * particular, no participant's email is sent to the client: nothing
 * renders it, and every participant in a room can currently see this
 * payload, so it would otherwise leak everyone's email to everyone else
 * in the room for no functional reason.
 */
export async function getRoomInfo(roomCode: string) {
  try {
    const room = await prisma.room.findUnique({
      where: { code: normalizeRoomCode(roomCode) },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        participants: {
          where: { status: "ACTIVE" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        submittedWords: {
          select: { userId: true },
        },
        game: {
          select: { id: true },
        },
      },
    });

    if (!room) {
      return null;
    }

    return {
      ...room,
      participantCount: room.participants.length,
      wordSubmittedBy: room.submittedWords.map((w: any) => w.userId),
      gameId: room.game?.id ?? null,
    };
  } catch (error) {
    console.error("Error getting room info:", error);
    return null;
  }
}

/**
 * Submit a word for the game.
 * The submitting user is always the currently authenticated user — never a
 * client-supplied id, since the secret word is tied to a specific player.
 */
export async function submitWord(
  roomCode: string,
  wordId: string,
  wordText: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    // Check rate limit for word submission
    const rateLimit = await checkRateLimit(
      `submit-word-${userId}`,
      RATE_LIMIT_CONFIGS.WORD_SUBMISSION
    );

    if (!rateLimit.allowed) {
      logger.warn("word", "Word submission rate limit exceeded", { userId, roomCode }, userId);
      return { success: false, error: rateLimit.message || "Limite de submissões atingido" };
    }

    const room = await prisma.room.findUnique({
      where: { code: normalizeRoomCode(roomCode) },
    });

    if (!room) {
      return { success: false, error: "Sala não encontrada" };
    }

    const roomId = room.id;

    // Check if user already submitted a word for this room
    const existing = await prisma.submittedWord.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });

    if (existing) {
      return { success: false, error: "Você já enviou uma palavra para esta sala" };
    }

    // Create submitted word record
    await prisma.submittedWord.create({
      data: {
        roomId,
        userId,
        wordId,
        wordText,
      },
    });

    logger.info("word", "Palavra submetida", { userId, roomId, wordLength: wordText.length }, userId);
    revalidatePath(`/room/${room.code}`);
    emitRoomUpdate(room.code);

    // Auto-start: once every current participant has a word in, there's no
    // real reason to make everyone wait on the host to click "Iniciar
    // Partida" — see startGameInternal. Two players submitting their final
    // word at nearly the same time can both observe "everyone's in" and
    // both attempt this; that's harmless because Game.roomId is @unique,
    // so at most one of the concurrent prisma.game.create calls actually
    // succeeds and the other fails cleanly (logged, not surfaced to this
    // player — their own word submission still succeeded).
    const activeParticipantCount = await prisma.roomParticipant.count({
      where: { roomId, status: "ACTIVE" },
    });
    const totalSubmittedCount = await prisma.submittedWord.count({ where: { roomId } });

    if (activeParticipantCount >= 2 && totalSubmittedCount >= activeParticipantCount) {
      const startResult = await startGameInternal(roomId, userId);
      if (!startResult.success) {
        logger.error(
          "game",
          "Falha ao iniciar partida automaticamente após envio de palavra",
          new Error(startResult.error || "unknown"),
          { roomId },
          userId
        );
      }
    }

    return { success: true };
  } catch (error) {
    logger.error("word", "Erro ao enviar palavra", error as Error, { userId, roomCode }, userId);
    return { success: false, error: "Falha ao enviar palavra" };
  }
}

/**
 * Shared core of match creation. Used by both the host-triggered startGame
 * Server Action and the automatic start that fires the instant every
 * participant has submitted a word (see submitWord) — the host's "Iniciar
 * Partida" button is a manual fallback here, not the only path: once every
 * current participant has a word in, there's no reason to make everyone
 * wait on a click.
 */
async function startGameInternal(
  roomId: string,
  actorUserId?: string
): Promise<{ success: boolean; gameId?: string; error?: string }> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        participants: { where: { status: "ACTIVE" } },
        submittedWords: true,
      },
    });

    if (!room) {
      return { success: false, error: "Sala não encontrada" };
    }

    if (room.status !== "LOBBY") {
      return { success: false, error: "O jogo já foi iniciado" };
    }

    // Check if all participants have submitted words
    const participantCount = room.participants.length;
    const submittedCount = room.submittedWords.length;

    if (submittedCount < participantCount) {
      return {
        success: false,
        error: `Not all participants have submitted words (${submittedCount}/${participantCount})`,
      };
    }

    if (participantCount < 2) {
      return { success: false, error: "Pelo menos 2 participantes são necessários" };
    }

    // Create game
    const game = await prisma.game.create({
      data: {
        roomId,
        status: "ACTIVE",
        totalRounds: participantCount,
        currentRound: 1,
      },
    });

    // Create the first round: pick one of the submitted words as the answer
    // and put its owner into spectator mode for this round. Without this,
    // the game record exists but has no playable round.
    const firstRound = await createRound(game.id, roomId, 1);

    if (!firstRound.success) {
      // Roll back the game we just created so the room doesn't end up
      // IN_PROGRESS with a game that has no rounds.
      await prisma.game.delete({ where: { id: game.id } });
      logger.error(
        "game",
        "Falha ao criar a primeira rodada",
        new Error(firstRound.error || "unknown"),
        { roomId, gameId: game.id },
        actorUserId
      );
      return { success: false, error: firstRound.error || "Falha ao criar a primeira rodada" };
    }

    // Update room status
    await prisma.room.update({
      where: { id: roomId },
      data: {
        status: "IN_PROGRESS",
        gameStartedAt: new Date(),
      },
    });

    logger.info("game", "Jogo iniciado", { roomId, gameId: game.id, participantCount, totalRounds: participantCount }, actorUserId);
    revalidatePath(`/room/${room.code}`);
    emitRoomUpdate(room.code);
    return { success: true, gameId: game.id };
  } catch (error) {
    logger.error("game", "Erro ao iniciar jogo", error as Error, { roomId }, actorUserId);
    return { success: false, error: "Falha ao iniciar o jogo" };
  }
}

/**
 * Start the game.
 * Only the host (the currently authenticated user, verified against the
 * room's hostId — never a client-supplied id) can start manually — kept as
 * a fallback for the rare case where the automatic start (see submitWord)
 * doesn't fire for some reason. All participants must have submitted
 * words, same as the automatic path.
 */
export async function startGame(
  roomCode: string
): Promise<{ success: boolean; gameId?: string; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    const room = await prisma.room.findUnique({
      where: { code: normalizeRoomCode(roomCode) },
      select: { id: true, hostId: true },
    });

    if (!room) {
      return { success: false, error: "Sala não encontrada" };
    }

    if (room.hostId !== userId) {
      logger.warn("security", "Non-host attempted to start game", { userId, roomId: room.id }, userId);
      return { success: false, error: "Apenas o anfitrião pode iniciar o jogo" };
    }

    return await startGameInternal(room.id, userId);
  } catch (error) {
    logger.error("game", "Erro ao iniciar jogo", error as Error, { roomCode }, userId);
    return { success: false, error: "Falha ao iniciar o jogo" };
  }
}
