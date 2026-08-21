"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { evaluateAttempt, MAX_ATTEMPTS } from "@/lib/wordle-evaluation";
import { getRandomCommonWord, validateAttemptWord } from "@/server/word-service";
import { MIN_WORD_LENGTH, MAX_WORD_LENGTH } from "@/lib/word-normalization";
import type { AttemptLetterResult } from "@/types";

/**
 * Single-player mode: one user against a secret word the server picks,
 * with no room, no other participants, and no realtime layer — none of
 * that applies when there's only one player. This file mirrors the same
 * security posture as the multiplayer game (server-authoritative secret
 * word, server-side attempt validation/evaluation) but never touches
 * Room/Game/Round or the global ranking — see the schema comment on
 * SinglePlayerGame for why its statistics are kept separate.
 */

/**
 * Start a new single-player game.
 * The player is always the currently authenticated user — never a
 * client-supplied id. Picks a random word from the dictionary as the
 * secret answer; the word itself is never returned to the caller.
 */
export async function startSinglePlayerGame(
  wordLength: number,
): Promise<{ success: boolean; gameId?: string; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
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

    const rateLimit = await checkRateLimit(
      `single-player-start-${userId}`,
      RATE_LIMIT_CONFIGS.SINGLE_PLAYER_START,
    );

    if (!rateLimit.allowed) {
      logger.warn(
        "game",
        "Single-player start rate limit exceeded",
        { userId },
        userId,
      );
      return {
        success: false,
        error: rateLimit.message || "Limite de partidas atingido",
      };
    }

    // A player can only have one single-player game going at a time —
    // resume it instead of silently abandoning it with a new one.
    const existingActive = await prisma.singlePlayerGame.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { id: true },
    });

    if (existingActive) {
      return { success: true, gameId: existingActive.id };
    }

    // Biased toward common/recognizable words rather than a uniform draw
    // from the whole dictionary — nobody vouches for the answer's
    // "does this make sense" the way a human does when submitting a
    // multiplayer secret word, so an unfiltered draw surfaces obscure
    // entries too easily. See getRandomCommonWord's own comment for how.
    const word = await getRandomCommonWord(wordLength);

    if (!word) {
      logger.error(
        "game",
        "Nenhuma palavra disponível para o modo solo",
        new Error(`No words available for length ${wordLength}`),
        { userId, wordLength },
        userId,
      );
      return {
        success: false,
        error: "Nenhuma palavra disponível para esse tamanho",
      };
    }

    const game = await prisma.singlePlayerGame.create({
      data: {
        userId,
        wordLength,
        answerWordId: word.id,
        answerWord: word.word,
        status: "ACTIVE",
      },
    });

    logger.info(
      "game",
      "Partida solo iniciada",
      { userId, gameId: game.id, wordLength },
      userId,
    );
    revalidatePath("/play");
    return { success: true, gameId: game.id };
  } catch (error) {
    logger.error(
      "game",
      "Erro ao iniciar partida solo",
      error as Error,
      { userId, wordLength },
      userId,
    );
    return { success: false, error: "Falha ao iniciar partida" };
  }
}

/**
 * Submit an attempt for a single-player game.
 * The player is always the currently authenticated user — never a
 * client-supplied id — and must own the game being played.
 */
export async function submitSinglePlayerAttempt(
  gameId: string,
  attemptText: string,
): Promise<{
  success: boolean;
  feedback?: AttemptLetterResult[];
  isCorrect?: boolean;
  gameOver?: boolean;
  won?: boolean;
  answerWord?: string;
  error?: string;
}> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    const rateLimit = await checkRateLimit(
      `game-attempt-${userId}`,
      RATE_LIMIT_CONFIGS.GAME_ATTEMPT,
    );

    if (!rateLimit.allowed) {
      logger.warn(
        "game",
        "Single-player attempt rate limit exceeded",
        { userId, gameId },
        userId,
      );
      return {
        success: false,
        error: rateLimit.message || "Aguarde antes de enviar outra tentativa",
      };
    }

    const game = await prisma.singlePlayerGame.findUnique({
      where: { id: gameId },
      include: { attempts: true },
    });

    if (!game) {
      return { success: false, error: "Partida não encontrada" };
    }

    if (game.userId !== userId) {
      logger.warn(
        "security",
        "User attempted to play another user's single-player game",
        { userId, gameId, ownerId: game.userId },
        userId,
      );
      return { success: false, error: "Você não tem acesso a esta partida" };
    }

    if (game.status !== "ACTIVE") {
      return { success: false, error: "Esta partida já terminou" };
    }

    const wordValidation = await validateAttemptWord(
      attemptText,
      game.wordLength,
    );
    if (!wordValidation.valid) {
      logger.warn(
        "word",
        "Invalid single-player word submitted",
        { userId, word: attemptText, reason: wordValidation.error },
        userId,
      );
      return { success: false, error: wordValidation.error };
    }

    const attemptCount = game.attempts.length;

    if (game.attempts.some((a: any) => a.isCorrect)) {
      return { success: false, error: "Você já acertou esta partida" };
    }
    if (attemptCount >= MAX_ATTEMPTS) {
      return { success: false, error: "Você já usou todas as suas tentativas" };
    }

    const normalizedWord = attemptText
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    const normalizedPrevious = game.attempts.map((a: any) =>
      a.attemptText.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
    );
    if (normalizedPrevious.includes(normalizedWord)) {
      return { success: false, error: "Você já tentou esta palavra" };
    }

    const feedback = evaluateAttempt(attemptText, game.answerWord);
    const isCorrect = feedback.every((f) => f.status === "CORRECT");
    const newAttemptNumber = attemptCount + 1;

    await prisma.singlePlayerAttempt.create({
      data: {
        gameId,
        attemptText,
        attemptNumber: newAttemptNumber,
        result: feedback,
        isCorrect,
      },
    });

    logger.info(
      "game",
      "Tentativa solo enviada",
      { userId, gameId, attemptNumber: newAttemptNumber, isCorrect },
      userId,
    );

    const gameOver = isCorrect || newAttemptNumber >= MAX_ATTEMPTS;
    let answerWord: string | undefined;

    if (gameOver) {
      // Atomic guard: only the request that actually flips the game from
      // ACTIVE proceeds to update statistics — two rapid submissions from
      // the same user (e.g. two open tabs) could otherwise both observe
      // "game over" and both increment totalGamesPlayed/streak for the
      // same game.
      const finishResult = await prisma.singlePlayerGame.updateMany({
        where: { id: gameId, status: "ACTIVE" },
        data: { status: isCorrect ? "WON" : "LOST", endedAt: new Date() },
      });

      if (finishResult.count > 0) {
        await updateSinglePlayerStatistics(userId, isCorrect, newAttemptNumber);
        logger.info(
          "game",
          "Partida solo encerrada",
          { userId, gameId, won: isCorrect, attemptsUsed: newAttemptNumber },
          userId,
        );
      }

      answerWord = game.answerWord;
      revalidatePath(`/play/${gameId}`);
    }

    return {
      success: true,
      feedback: feedback.map((f) => ({ letter: f.letter, status: f.status })),
      isCorrect,
      gameOver,
      won: gameOver ? isCorrect : undefined,
      answerWord,
    };
  } catch (error) {
    logger.error(
      "game",
      "Erro ao enviar tentativa solo",
      error as Error,
      { userId, gameId },
      userId,
    );
    return { success: false, error: "Falha ao enviar tentativa" };
  }
}

/**
 * Folds one finished game's result into the player's single-player
 * statistics. Kept as its own function so submitSinglePlayerAttempt's
 * atomic guard (above) can call it exactly once per game, never twice.
 */
async function updateSinglePlayerStatistics(
  userId: string,
  won: boolean,
  attemptsUsed: number,
): Promise<void> {
  const existing = await prisma.singlePlayerStatistics.findUnique({
    where: { userId },
  });

  const currentStreak = won ? (existing?.currentStreak ?? 0) + 1 : 0;
  const bestStreak = Math.max(existing?.bestStreak ?? 0, currentStreak);
  const guessDistribution = existing?.guessDistribution ?? [0, 0, 0, 0, 0, 0];
  if (won && attemptsUsed >= 1 && attemptsUsed <= MAX_ATTEMPTS) {
    guessDistribution[attemptsUsed - 1] =
      (guessDistribution[attemptsUsed - 1] ?? 0) + 1;
  }

  await prisma.singlePlayerStatistics.upsert({
    where: { userId },
    create: {
      userId,
      totalGamesPlayed: 1,
      totalWins: won ? 1 : 0,
      currentStreak,
      bestStreak,
      guessDistribution,
      lastPlayedAt: new Date(),
    },
    update: {
      totalGamesPlayed: (existing?.totalGamesPlayed ?? 0) + 1,
      totalWins: (existing?.totalWins ?? 0) + (won ? 1 : 0),
      currentStreak,
      bestStreak,
      guessDistribution,
      lastPlayedAt: new Date(),
    },
  });
}

/**
 * Get the current state of a single-player game for its owner.
 * The secret answer is only included once the game is no longer ACTIVE —
 * same rule as the multiplayer round's answerWord.
 */
export async function getSinglePlayerGameState(gameId: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  try {
    const game = await prisma.singlePlayerGame.findUnique({
      where: { id: gameId },
      include: {
        attempts: { orderBy: { attemptNumber: "asc" } },
      },
    });

    if (!game || game.userId !== userId) {
      return null;
    }

    return {
      id: game.id,
      wordLength: game.wordLength,
      status: game.status,
      attempts: game.attempts,
      answerWord: game.status !== "ACTIVE" ? game.answerWord : undefined,
      createdAt: game.createdAt,
      endedAt: game.endedAt,
    };
  } catch (error) {
    console.error("Error getting single-player game state:", error);
    return null;
  }
}

/**
 * Get the currently authenticated user's active (unfinished) single-player
 * game, if any — used so the landing screen can offer to resume it instead
 * of only offering to start a new one.
 */
export async function getActiveSinglePlayerGame(): Promise<{
  id: string;
  wordLength: number;
} | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  try {
    return await prisma.singlePlayerGame.findFirst({
      where: { userId, status: "ACTIVE" },
      select: { id: true, wordLength: true },
    });
  } catch (error) {
    console.error("Error getting active single-player game:", error);
    return null;
  }
}

/**
 * Get the currently authenticated user's single-player statistics.
 * Lazily creates a zeroed row on first read, same pattern as
 * getUserStatistics for the multiplayer ranking.
 */
export async function getSinglePlayerStatistics(userId: string) {
  try {
    const stats = await prisma.singlePlayerStatistics.findUnique({
      where: { userId },
    });

    if (!stats) {
      return {
        totalGamesPlayed: 0,
        totalWins: 0,
        currentStreak: 0,
        bestStreak: 0,
        guessDistribution: [0, 0, 0, 0, 0, 0],
        lastPlayedAt: null as Date | null,
      };
    }

    return {
      totalGamesPlayed: stats.totalGamesPlayed,
      totalWins: stats.totalWins,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      guessDistribution: stats.guessDistribution,
      lastPlayedAt: stats.lastPlayedAt,
    };
  } catch (error) {
    console.error("Error getting single-player statistics:", error);
    return null;
  }
}
