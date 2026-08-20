"use server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

/**
 * Create a new game room
 */
export async function createRoom(
  hostId: string,
  wordLength: number
): Promise<{ success: boolean; roomId?: string; error?: string }> {
  try {
    if (!hostId) {
      return { success: false, error: "ID do anfitrião é obrigatório" };
    }

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
 * Join a room
 */
export async function joinRoom(
  roomId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!roomId || !userId) {
      return { success: false, error: "Room ID and User ID are required" };
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
    return { success: true };
  } catch (error) {
    logger.error("room", "Erro ao entrar na sala", error as Error, { userId, roomId }, userId);
    return { success: false, error: "Falha ao entrar na sala" };
  }
}

/**
 * Leave a room
 */
export async function leaveRoom(
  roomId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
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
      },
    });

    if (!room) {
      return null;
    }

    return {
      ...room,
      participantCount: room.participants.length,
      wordSubmittedBy: room.submittedWords.map((w: any) => w.userId),
    };
  } catch (error) {
    console.error("Error getting room info:", error);
    return null;
  }
}

/**
 * Submit a word for the game
 */
export async function submitWord(
  roomId: string,
  userId: string,
  wordId: string,
  wordText: string
): Promise<{ success: boolean; error?: string }> {
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
    return { success: true };
  } catch (error) {
    logger.error("word", "Erro ao enviar palavra", error as Error, { userId, roomId }, userId);
    return { success: false, error: "Falha ao enviar palavra" };
  }
}

/**
 * Start the game
 * Only the host can start, and all participants must have submitted words
 */
export async function startGame(
  roomId: string,
  userId: string
): Promise<{ success: boolean; gameId?: string; error?: string }> {
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
    return { success: true, gameId: game.id };
  } catch (error) {
    logger.error("game", "Erro ao iniciar jogo", error as Error, { roomId }, userId);
    return { success: false, error: "Falha ao iniciar o jogo" };
  }
}
