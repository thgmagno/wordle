"use server";

import { prisma } from "@/lib/prisma";
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
      return { success: false, error: "Host ID is required" };
    }

    if (![4, 5, 6].includes(wordLength)) {
      return { success: false, error: "Word length must be 4, 5, or 6" };
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

    revalidatePath("/");
    return { success: true, roomId: room.id };
  } catch (error) {
    console.error("Error creating room:", error);
    return { success: false, error: "Failed to create room" };
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
      return { success: false, error: "Room not found" };
    }

    if (room.status !== "LOBBY") {
      return { success: false, error: "Room is not accepting new players" };
    }

    if (room.participants.length >= room.maxPlayers) {
      return { success: false, error: "Room is full" };
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

    revalidatePath(`/room/${roomId}`);
    return { success: true };
  } catch (error) {
    console.error("Error joining room:", error);
    return { success: false, error: "Failed to join room" };
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
      return { success: false, error: "User not in room" };
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
      }
    }

    revalidatePath(`/room/${roomId}`);
    return { success: true };
  } catch (error) {
    console.error("Error leaving room:", error);
    return { success: false, error: "Failed to leave room" };
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
      return { success: false, error: "You have already submitted a word for this room" };
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

    revalidatePath(`/room/${roomId}`);
    return { success: true };
  } catch (error) {
    console.error("Error submitting word:", error);
    return { success: false, error: "Failed to submit word" };
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
      return { success: false, error: "Room not found" };
    }

    if (room.hostId !== userId) {
      return { success: false, error: "Only the host can start the game" };
    }

    if (room.status !== "LOBBY") {
      return { success: false, error: "Game has already been started" };
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
      return { success: false, error: "At least 2 participants are required" };
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

    revalidatePath(`/room/${roomId}`);
    return { success: true, gameId: game.id };
  } catch (error) {
    console.error("Error starting game:", error);
    return { success: false, error: "Failed to start game" };
  }
}
