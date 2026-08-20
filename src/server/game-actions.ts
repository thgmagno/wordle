"use server";

import { prisma } from "@/lib/prisma";
import { evaluateAttempt } from "@/lib/wordle-evaluation";
import { validateAttemptWord } from "@/server/word-service";
import { revalidatePath } from "next/cache";

/**
 * Submit an attempt for the current round
 */
export async function submitAttempt(
  roundId: string,
  userId: string,
  attemptText: string
): Promise<{
  success: boolean;
  feedback?: Array<{ letter: string; status: string }>;
  isCorrect?: boolean;
  error?: string;
}> {
  try {
    // Get round info
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        game: {
          include: {
            room: true,
          },
        },
      },
    });

    if (!round) {
      return { success: false, error: "Round not found" };
    }

    if (round.status !== "ACTIVE") {
      return { success: false, error: "Round is not active" };
    }

    // Verify user is not the word owner (spectator)
    if (round.wordOwnerId === userId) {
      return { success: false, error: "You cannot participate in this round (spectator mode)" };
    }

    // Validate word
    const wordValidation = await validateAttemptWord(attemptText, round.game.room.wordLength);
    if (!wordValidation.valid) {
      return { success: false, error: wordValidation.error };
    }

    // Check if user already submitted this word
    const previousAttempts = await prisma.roundAttempt.findMany({
      where: {
        roundId,
        userId,
      },
    });

    const attemptCount = previousAttempts.length;
    const normalizedWord = attemptText.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const normalizedPrevious = previousAttempts.map((a: any) =>
      a.attemptText.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    );

    if (normalizedPrevious.includes(normalizedWord)) {
      return { success: false, error: "You already tried this word" };
    }

    // Evaluate attempt
    const feedback = evaluateAttempt(attemptText, round.answerWord);
    const isCorrect = feedback.every((f) => f.status === "CORRECT");

    // Create attempt record
    const attempt = await prisma.roundAttempt.create({
      data: {
        roundId,
        userId,
        attemptText,
        attemptNumber: attemptCount + 1,
        result: feedback,
        isCorrect,
      },
    });

    // If correct, end round
    if (isCorrect) {
      await prisma.round.update({
        where: { id: roundId },
        data: {
          status: "FINISHED",
          endedAt: new Date(),
        },
      });

      // Calculate score for this round
      const scorePerAttempt = 100 - (attemptCount * 10); // Fewer attempts = higher score
      const finalScore = Math.max(scorePerAttempt, 10); // Minimum 10 points

      // Update or create match score
      const existing = await prisma.matchScore.findUnique({
        where: {
          gameId_userId: {
            gameId: round.gameId,
            userId,
          },
        },
      });

      if (existing) {
        await prisma.matchScore.update({
          where: { id: existing.id },
          data: {
            finalScore: existing.finalScore + finalScore,
            roundScores: [
              ...existing.roundScores,
              {
                roundNumber: round.roundNumber,
                score: finalScore,
                attemptsUsed: attemptCount + 1,
              },
            ],
          },
        });
      } else {
        await prisma.matchScore.create({
          data: {
            gameId: round.gameId,
            userId,
            finalScore,
            roundScores: [
              {
                roundNumber: round.roundNumber,
                score: finalScore,
                attemptsUsed: attemptCount + 1,
              },
            ],
          },
        });
      }
    }

    revalidatePath(`/game/${round.gameId}`);

    return {
      success: true,
      feedback: feedback.map((f) => ({
        letter: f.letter,
        status: f.status,
      })),
      isCorrect,
    };
  } catch (error) {
    console.error("Error submitting attempt:", error);
    return { success: false, error: "Failed to submit attempt" };
  }
}

/**
 * Get game state for a player
 */
export async function getGameState(gameId: string, userId: string) {
  try {
    const gameData = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!gameData) {
      return null;
    }

    const fullGame = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        room: {
          include: {
            host: {
              select: { id: true, name: true, image: true },
            },
            participants: {
              where: { status: "ACTIVE" },
              include: {
                user: {
                  select: { id: true, name: true, image: true },
                },
              },
            },
          },
        },
        rounds: {
          where: { roundNumber: gameData.currentRound },
          include: {
            attempts: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!fullGame || !fullGame.rounds[0]) {
      return null;
    }

    const round = fullGame.rounds[0];

    // Check if user is spectator for this round
    const isSpectator = round.wordOwnerId === userId;

    // Don't expose answer word to client
    return {
      ...fullGame,
      rounds: [
        {
          ...round,
          answerWord: isSpectator ? round.answerWord : undefined, // Show to spectator, hide to others
        },
      ],
      isSpectator,
    };
  } catch (error) {
    console.error("Error getting game state:", error);
    return null;
  }
}

/**
 * Get round info
 */
export async function getRoundInfo(roundId: string) {
  try {
    return await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        attempts: {
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("Error getting round info:", error);
    return null;
  }
}

/**
 * Get user's attempts in a round
 */
export async function getUserAttempts(roundId: string, userId: string) {
  try {
    return await prisma.roundAttempt.findMany({
      where: {
        roundId,
        userId,
      },
      orderBy: { attemptNumber: "asc" },
    });
  } catch (error) {
    console.error("Error getting user attempts:", error);
    return [];
  }
}

/**
 * Advance to next round
 */
export async function advanceToNextRound(gameId: string, hostUserId: string): Promise<{
  success: boolean;
  nextRoundId?: string;
  error?: string;
}> {
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { room: true },
    });

    if (!game) {
      return { success: false, error: "Game not found" };
    }

    if (game.room.hostId !== hostUserId) {
      return { success: false, error: "Only the host can advance rounds" };
    }

    if (game.status === "FINISHED") {
      return { success: false, error: "Game is already finished" };
    }

    const nextRoundNumber = game.currentRound + 1;

    if (nextRoundNumber > game.totalRounds) {
      // Game finished
      await prisma.game.update({
        where: { id: gameId },
        data: {
          status: "FINISHED",
          endedAt: new Date(),
        },
      });

      await prisma.room.update({
        where: { id: game.roomId },
        data: {
          status: "FINISHED",
          gameEndedAt: new Date(),
        },
      });

      return { success: true };
    }

    // Get submitted words for next round
    const submittedWords = await prisma.submittedWord.findMany({
      where: { roomId: game.roomId },
    });

    if (submittedWords.length === 0) {
      return { success: false, error: "No words available for next round" };
    }

    // Select a different word than the last round
    const previousRounds = await prisma.round.findMany({
      where: { gameId },
      select: { answerWordId: true },
    });

    const usedWordIds = previousRounds.map((r: any) => r.answerWordId);
    const availableWords = submittedWords.filter((w: any) => !usedWordIds.includes(w.wordId));

    if (availableWords.length === 0) {
      return { success: false, error: "No new words available for next round" };
    }

    // Pick a random word
    const selectedWord = availableWords[Math.floor(Math.random() * availableWords.length)];

    // Create new round
    const newRound = await prisma.round.create({
      data: {
        gameId,
        roundNumber: nextRoundNumber,
        answerWordId: selectedWord.wordId,
        answerWord: selectedWord.wordText,
        wordOwnerId: selectedWord.userId,
        status: "ACTIVE",
      },
    });

    // Update game
    await prisma.game.update({
      where: { id: gameId },
      data: { currentRound: nextRoundNumber },
    });

    revalidatePath(`/game/${gameId}`);

    return { success: true, nextRoundId: newRound.id };
  } catch (error) {
    console.error("Error advancing to next round:", error);
    return { success: false, error: "Failed to advance round" };
  }
}
