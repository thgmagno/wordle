"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { createRound } from "@/server/game-actions";
import { emitRoomUpdate } from "@/lib/realtime";

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

    // Create room
    const room = await prisma.room.create({
      data: {
        hostId,
        wordLength,
        status: "LOBBY",
        maxPlayers: 10,
      },
    });

    // Add host as participant
    await prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        userId: hostId,
        status: "ACTIVE",
      },
    });

    logger.info("room", "Sala criada", { roomId: room.id, hostId, wordLength }, hostId);
    revalidatePath("/");
    return { success: true, roomId: room.id };
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
  roomId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    if (!roomId) {
      return { success: false, error: "Room ID is required" };
    }

    // Check if room exists and is in LOBBY status
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { participants: true },
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

    logger.info("room", "Usuário entrou na sala", { userId, roomId, participantCount: room.participants.length + 1 }, userId);
    revalidatePath(`/room/${roomId}`);
    emitRoomUpdate(roomId);
    return { success: true };
  } catch (error) {
    logger.error("room", "Erro ao entrar na sala", error as Error, { userId, roomId }, userId);
    return { success: false, error: "Falha ao entrar na sala" };
  }
}

/**
 * Leave a room.
 * The leaving user is always the currently authenticated user — never a
 * client-supplied id.
 */
export async function leaveRoom(
  roomId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    const participant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
      include: { room: true },
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
    if (participant.room.hostId === userId) {
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

    logger.info("room", "Usuário saiu da sala", { userId, roomId }, userId);
    revalidatePath(`/room/${roomId}`);
    emitRoomUpdate(roomId);
    return { success: true };
  } catch (error) {
    logger.error("room", "Erro ao sair da sala", error as Error, { userId, roomId }, userId);
    return { success: false, error: "Falha ao sair da sala" };
  }
}

/**
 * Get room info
 */
export async function getRoomInfo(roomId: string) {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true,
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
                email: true,
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
  roomId: string,
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
      logger.warn("word", "Word submission rate limit exceeded", { userId, roomId }, userId);
      return { success: false, error: rateLimit.message || "Limite de submissões atingido" };
    }

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
    revalidatePath(`/room/${roomId}`);
    emitRoomUpdate(roomId);
    return { success: true };
  } catch (error) {
    logger.error("word", "Erro ao enviar palavra", error as Error, { userId, roomId }, userId);
    return { success: false, error: "Falha ao enviar palavra" };
  }
}

/**
 * Start the game.
 * Only the host (the currently authenticated user, verified against the
 * room's hostId — never a client-supplied id) can start, and all
 * participants must have submitted words.
 */
export async function startGame(
  roomId: string
): Promise<{ success: boolean; gameId?: string; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    // Verify user is host
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

    if (room.hostId !== userId) {
      logger.warn("security", "Non-host attempted to start game", { userId, roomId }, userId);
      return { success: false, error: "Apenas o anfitrião pode iniciar o jogo" };
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
        userId
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

    logger.info("game", "Jogo iniciado", { roomId, gameId: game.id, participantCount, totalRounds: participantCount }, userId);
    revalidatePath(`/room/${roomId}`);
    emitRoomUpdate(roomId);
    return { success: true, gameId: game.id };
  } catch (error) {
    logger.error("game", "Erro ao iniciar jogo", error as Error, { roomId }, userId);
    return { success: false, error: "Falha ao iniciar o jogo" };
  }
}
