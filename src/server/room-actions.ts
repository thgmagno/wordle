"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { createRound } from "@/server/game-actions";
import { emitRoomUpdate, emitGameUpdate } from "@/lib/realtime";
import { generateRoomCode, normalizeRoomCode } from "@/lib/room-code";
import { MIN_WORD_LENGTH, MAX_WORD_LENGTH } from "@/lib/word-normalization";

/**
 * Self-heal a room stuck showing IN_PROGRESS with no currentGameId set.
 * The only way this combination is supposed to exist is for a handful of
 * milliseconds mid-flight inside startGameInternal, between the moment it
 * atomically claims the room (LOBBY -> IN_PROGRESS) and the moment it
 * finishes creating the match and points currentGameId at it — no caller
 * outside that function should ever actually observe it. But if anything
 * in between throws (game/round creation failing, a transient Mongo
 * blip), the room is left permanently stuck in exactly this state unless
 * something rolls the claim back — startGameInternal now does that for
 * every failure it can catch, but a room that got stuck here *before*
 * that fix still needs a way out too. There's nothing to salvage from
 * this state (no Game was ever fully set up), so the fix is simply to
 * revert the claim: back to LOBBY, ready for the host's "Iniciar Partida
 * Agora" fallback (or another word submission) to retry cleanly, instead
 * of a room that's stuck forever with no way out short of abandoning it.
 */
async function repairStuckInProgressRoom<
  T extends { id: string; status: string; currentGameId: string | null },
>(room: T): Promise<T> {
  if (room.status !== "IN_PROGRESS" || room.currentGameId) {
    return room;
  }

  await prisma.room.update({
    where: { id: room.id },
    data: { status: "LOBBY", gameStartedAt: null },
  });
  logger.warn(
    "room",
    "Sala presa em IN_PROGRESS sem partida associada — revertida para LOBBY",
    { roomId: room.id },
  );

  return { ...room, status: "LOBBY" };
}

/**
 * Find the room (if any) a user currently has an ACTIVE participation in,
 * restricted to rooms that haven't finished (LOBBY or IN_PROGRESS) — a
 * FINISHED room has nothing to go back to (unless the host uses "Jogar
 * Novamente" — see playAgain — which resets it back to LOBBY, at which
 * point it counts again like any other open room), so it doesn't count as
 * "still in a room" either for the dashboard's "Sala Atual" card or the
 * one-room-at-a-time guard below. Shared by createRoom, joinRoom, and
 * getActiveRoomForUser so all three agree on exactly what "already in a
 * room" means.
 *
 * Also excludes a room whose *current* game already finished, even if
 * Room.status itself somehow still reads IN_PROGRESS: advanceGameInternal
 * (in game-actions.ts) flips Game.status and Room.status in two separate
 * writes, not one transaction, so a failure between them — or a request
 * that got interrupted — can leave the room stuck showing "in progress"
 * forever, with no way for anyone to create or join a new room. Checking
 * the room's currentGameId directly here means a room already in that
 * stuck state unblocks itself immediately, with no manual data fix
 * needed. This has to go by currentGameId specifically, not "does this
 * room have any finished game in its history" — a room that has played
 * (and correctly finished) several matches via "Jogar Novamente" would
 * otherwise look permanently stuck the instant its very first match ended.
 */
async function findActiveRoomParticipation(userId: string, excludeRoomId?: string) {
  const participation = await prisma.roomParticipant.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      roomId: excludeRoomId ? { not: excludeRoomId } : undefined,
      room: { status: { in: ["LOBBY", "IN_PROGRESS"] } },
    },
    include: {
      room: {
        include: { participants: { where: { status: "ACTIVE" } } },
      },
    },
  });

  if (!participation) {
    return null;
  }

  participation.room = await repairStuckInProgressRoom(participation.room);

  if (participation.room.currentGameId) {
    const currentGame = await prisma.game.findUnique({
      where: { id: participation.room.currentGameId },
      select: { status: true },
    });
    if (currentGame?.status === "FINISHED") {
      return null;
    }
  }

  return participation;
}

/**
 * Get the room the currently authenticated user is already active in, if
 * any — used by the dashboard to offer a way back into it (a user who hit
 * the browser's back button after joining/creating a room otherwise had
 * no link back to it short of knowing the code by heart) and to explain
 * why creating/joining another room is blocked.
 */
export async function getActiveRoomForUser(): Promise<{
  code: string;
  wordLength: number;
  status: "LOBBY" | "IN_PROGRESS";
  participantCount: number;
} | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  try {
    const participation = await findActiveRoomParticipation(userId);
    if (!participation) {
      return null;
    }

    return {
      code: participation.room.code,
      wordLength: participation.room.wordLength,
      status: participation.room.status as "LOBBY" | "IN_PROGRESS",
      participantCount: participation.room.participants.length,
    };
  } catch (error) {
    console.error("Error getting active room for user:", error);
    return null;
  }
}

/**
 * Create a new game room.
 * The host is always the currently authenticated user — never a
 * client-supplied id, to prevent creating rooms in someone else's name.
 */
export async function createRoom(
  wordLength: number
): Promise<{ success: boolean; roomId?: string; error?: string; activeRoomCode?: string }> {
  const session = await auth();
  const hostId = session?.user?.id;

  if (!hostId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    if (
      !Number.isInteger(wordLength) ||
      wordLength < MIN_WORD_LENGTH ||
      wordLength > MAX_WORD_LENGTH
    ) {
      return {
        success: false,
        error: `O comprimento da palavra deve ser entre ${MIN_WORD_LENGTH} e ${MAX_WORD_LENGTH}`,
      };
    }

    // One room at a time: creating a second room while already active in
    // another would leave the user stuck in two places at once, with no
    // clean way to tell which one they meant to be playing in.
    const activeElsewhere = await findActiveRoomParticipation(hostId);
    if (activeElsewhere) {
      return {
        success: false,
        error: "Você já está em uma sala. Saia dela antes de criar uma nova.",
        activeRoomCode: activeElsewhere.room.code,
      };
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
): Promise<{ success: boolean; error?: string; activeRoomCode?: string }> {
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

    // One room at a time: this is a genuine "join" from here on (the
    // participant above is either missing or LEFT, never this room's own
    // ACTIVE row), so check whether the user is ACTIVE in a *different*
    // room before adding them to this one. Excludes this room's id, but
    // that's only ever relevant in theory — the ACTIVE case for this exact
    // room already returned above.
    const activeElsewhere = await findActiveRoomParticipation(userId, roomId);
    if (activeElsewhere) {
      return {
        success: false,
        error: "Você já está em outra sala. Saia dela antes de entrar em uma nova.",
        activeRoomCode: activeElsewhere.room.code,
      };
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
      },
    });

    if (!room) {
      return null;
    }

    const repairedRoom = await repairStuckInProgressRoom(room);

    return {
      ...repairedRoom,
      participantCount: repairedRoom.participants.length,
      wordSubmittedBy: repairedRoom.submittedWords.map((w: any) => w.userId),
      gameId: repairedRoom.currentGameId ?? null,
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
    // both attempt this; that's harmless because startGameInternal claims
    // the room's LOBBY->IN_PROGRESS transition atomically, so at most one
    // of the concurrent calls actually creates a game and the other fails
    // cleanly (logged, not surfaced to this player — their own word
    // submission still succeeded).
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

    // Atomic guard: only the caller that actually flips Room.status from
    // LOBBY to IN_PROGRESS proceeds to create the game. Two players
    // submitting their final word at nearly the same instant can both pass
    // every check above and both call this function (see submitWord's
    // auto-start) — without this, both would create a Game for the room.
    // Game.roomId isn't unique (a room can play more than one match across
    // its lifetime via "Jogar Novamente" — see playAgain), so that no
    // longer doubles as a race guard the way it once did; the room's own
    // status is the guard instead, the same pattern advanceGameInternal
    // already uses for the symmetric race at the *end* of a match.
    const claim = await prisma.room.updateMany({
      where: { id: roomId, status: "LOBBY" },
      data: { status: "IN_PROGRESS", gameStartedAt: new Date() },
    });

    if (claim.count === 0) {
      return { success: false, error: "O jogo já foi iniciado" };
    }

    // Everything from here until the room is pointed at its new game runs
    // under its own try/catch: ANYTHING that throws in this block —
    // game.create, createRound throwing instead of returning
    // {success:false} (e.g. a transient Mongo error), the final
    // currentGameId update itself — has to roll the claim above back to
    // LOBBY, or the room is left stuck IN_PROGRESS with no playable game
    // and no way for the host to retry, forever (this is exactly what
    // happened in production: createRound's own {success:false} path was
    // rolled back correctly, but nothing else in this block was). The
    // outer catch below only logs and returns failure — it never
    // undoes the claim, since by the time an exception reaches it there's
    // no way to tell whether the claim even happened.
    let game: Awaited<ReturnType<typeof prisma.game.create>> | undefined;
    try {
      game = await prisma.game.create({
        data: {
          roomId,
          status: "ACTIVE",
          totalRounds: participantCount,
          currentRound: 1,
        },
      });

      // Create the first round: pick one of the submitted words as the
      // answer and put its owner into spectator mode for this round.
      // Without this, the game record exists but has no playable round.
      const firstRound = await createRound(game.id, roomId, 1);

      if (!firstRound.success) {
        throw new Error(firstRound.error || "Falha ao criar a primeira rodada");
      }

      // Point the room at this match as its current one.
      await prisma.room.update({
        where: { id: roomId },
        data: { currentGameId: game.id },
      });
    } catch (setupError) {
      if (game) {
        await prisma.game.delete({ where: { id: game.id } }).catch(() => {
          // Already gone, or never fully created — nothing left to clean up.
        });
      }
      await prisma.room
        .update({
          where: { id: roomId },
          data: { status: "LOBBY", gameStartedAt: null },
        })
        .catch((rollbackError: unknown) => {
          // This is the actual "stuck forever" case: the claim can't be
          // undone. Logged loudly since there's no other way anyone would
          // find out — the host just sees a room that never starts.
          logger.error(
            "game",
            "Falha ao reverter sala para LOBBY após erro ao iniciar partida — sala pode ficar travada",
            rollbackError as Error,
            { roomId },
            actorUserId
          );
        });
      logger.error(
        "game",
        "Falha ao configurar partida após reivindicar a sala",
        setupError as Error,
        { roomId, gameId: game?.id },
        actorUserId
      );
      return {
        success: false,
        error: setupError instanceof Error ? setupError.message : "Falha ao iniciar o jogo",
      };
    }

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

/**
 * Change a room's word length after it's already been created. Only the
 * host may do this, and only while the room is still in LOBBY — the round
 * count/answer selection for an actual match all assume a single fixed
 * length locked in at start time, so there's nothing sensible "change the
 * word length" could mean once a match is IN_PROGRESS or FINISHED.
 *
 * Every word already submitted was validated against the OLD length, so
 * none of them are valid for the new one — they're cleared here, and each
 * participant (including the host, if they'd already submitted) simply
 * submits again. This is the same tradeoff playAgain makes for the exact
 * same reason, just triggered by a length change instead of a finished
 * match.
 */
export async function changeRoomWordLength(
  roomCode: string,
  newWordLength: number
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    if (
      !Number.isInteger(newWordLength) ||
      newWordLength < MIN_WORD_LENGTH ||
      newWordLength > MAX_WORD_LENGTH
    ) {
      return {
        success: false,
        error: `O comprimento da palavra deve ser entre ${MIN_WORD_LENGTH} e ${MAX_WORD_LENGTH}`,
      };
    }

    const room = await prisma.room.findUnique({
      where: { code: normalizeRoomCode(roomCode) },
      select: { id: true, hostId: true, status: true, wordLength: true },
    });

    if (!room) {
      return { success: false, error: "Sala não encontrada" };
    }

    if (room.hostId !== userId) {
      logger.warn(
        "security",
        "Non-host attempted to change room word length",
        { userId, roomId: room.id },
        userId
      );
      return { success: false, error: "Apenas o anfitrião pode alterar o tamanho da palavra" };
    }

    if (room.status !== "LOBBY") {
      return {
        success: false,
        error: "Só é possível alterar o tamanho da palavra antes da partida começar",
      };
    }

    // No-op: nothing to clear or broadcast, and no reason to burn the
    // rate limit below on a value that's already current (e.g. the slider
    // getting dragged back to where it started).
    if (newWordLength === room.wordLength) {
      return { success: true };
    }

    const rateLimit = await checkRateLimit(
      `change-word-length-${userId}`,
      RATE_LIMIT_CONFIGS.CHANGE_ROOM_WORD_LENGTH
    );

    if (!rateLimit.allowed) {
      logger.warn(
        "room",
        "Change word length rate limit exceeded",
        { userId, roomId: room.id },
        userId
      );
      return { success: false, error: rateLimit.message || "Limite de alterações atingido" };
    }

    await prisma.submittedWord.deleteMany({ where: { roomId: room.id } });

    await prisma.room.update({
      where: { id: room.id },
      data: { wordLength: newWordLength },
    });

    logger.info(
      "room",
      "Tamanho da palavra da sala alterado",
      { roomId: room.id, oldWordLength: room.wordLength, newWordLength },
      userId
    );
    revalidatePath(`/room/${roomCode}`);
    emitRoomUpdate(roomCode);

    return { success: true };
  } catch (error) {
    logger.error(
      "room",
      "Erro ao alterar tamanho da palavra da sala",
      error as Error,
      { roomCode, newWordLength },
      userId
    );
    return { success: false, error: "Falha ao alterar o tamanho da palavra" };
  }
}

/**
 * Reset a room back to LOBBY after its match has finished, so the same
 * group can play another round without creating a new room and
 * re-sharing the code. Only the host may trigger this — same as
 * startGame — and only once the room's current match has genuinely
 * finished; there's nothing to "play again" from mid-match.
 *
 * The room keeps its code, its host, and its participant roster exactly
 * as they were (whoever is still ACTIVE stays ACTIVE — this is the whole
 * point, nobody has to rejoin). What resets is everything specific to the
 * match that just ended: every previously submitted secret word is
 * deleted (they were already used/exposed as round answers, and reusing
 * a stale one would be predictable for anyone who played before), and the
 * room is pointed at no current game. The finished Game/Round/MatchScore
 * records themselves are left alone — they're history, not state to roll
 * back, and finalizeGameStatistics already folded that match's result
 * into everyone's UserStatistics.
 */
export async function playAgain(
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
      select: { id: true, hostId: true, status: true, currentGameId: true },
    });

    if (!room) {
      return { success: false, error: "Sala não encontrada" };
    }

    if (room.hostId !== userId) {
      logger.warn("security", "Non-host attempted to restart room", { userId, roomId: room.id }, userId);
      return { success: false, error: "Apenas o anfitrião pode reiniciar a sala" };
    }

    if (room.status !== "FINISHED") {
      return { success: false, error: "A partida ainda não terminou" };
    }

    const rateLimit = await checkRateLimit(
      `play-again-${userId}`,
      RATE_LIMIT_CONFIGS.PLAY_AGAIN
    );

    if (!rateLimit.allowed) {
      logger.warn("room", "Play-again rate limit exceeded", { userId, roomId: room.id }, userId);
      return { success: false, error: rateLimit.message || "Limite de reinícios atingido" };
    }

    // Every previously submitted word belonged to the match that just
    // ended — clear them so each participant submits a fresh one for the
    // new match. Idempotent: a concurrent duplicate call (see the atomic
    // claim below) would just delete the same already-deleted rows again.
    await prisma.submittedWord.deleteMany({ where: { roomId: room.id } });

    // Atomic guard, same pattern as startGameInternal's LOBBY->IN_PROGRESS
    // claim: only the caller that actually flips Room.status from
    // FINISHED to LOBBY proceeds to broadcast the reset. Guards against a
    // double-click or two tabs both submitting this at once.
    const claim = await prisma.room.updateMany({
      where: { id: room.id, status: "FINISHED" },
      data: {
        status: "LOBBY",
        gameStartedAt: null,
        gameEndedAt: null,
        currentGameId: null,
      },
    });

    if (claim.count === 0) {
      return { success: false, error: "A sala não está disponível para reiniciar" };
    }

    logger.info("room", "Sala reiniciada para nova partida", { roomId: room.id, previousGameId: room.currentGameId }, userId);
    revalidatePath(`/room/${roomCode}`);
    emitRoomUpdate(roomCode);
    // Players still looking at the just-finished match's Game Over screen
    // are subscribed to that game's own channel (see useGameRealtime), not
    // the room's — without this, only the host (who navigates away
    // explicitly right after this action resolves) would ever learn the
    // room reopened; everyone else would be stuck looking at a stale
    // scoreboard until they manually went back to the dashboard.
    if (room.currentGameId) {
      emitGameUpdate(room.currentGameId);
    }

    return { success: true };
  } catch (error) {
    logger.error("room", "Erro ao reiniciar sala", error as Error, { roomCode }, userId);
    return { success: false, error: "Falha ao reiniciar a sala" };
  }
}
