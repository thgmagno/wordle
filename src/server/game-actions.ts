"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  evaluateAttempt,
  MAX_ATTEMPTS,
  haveAllPlayersFinishedRound,
} from "@/lib/wordle-evaluation";
import { validateAttemptWord } from "@/server/word-service";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { emitGameUpdate } from "@/lib/realtime";
import { finalizeGameStatistics } from "@/server/ranking-actions";

/**
 * Selects one of the words submitted to a room and creates a Round for it.
 * Shared by startGame (round 1) and advanceToNextRound (round 2+) so both
 * paths pick answers the same way and never reuse an already-played word.
 */
export async function createRound(
  gameId: string,
  roomId: string,
  roundNumber: number,
  excludeWordIds: string[] = []
): Promise<{ success: boolean; round?: { id: string }; error?: string }> {
  const submittedWords = await prisma.submittedWord.findMany({
    where: { roomId },
  });

  const availableWords = submittedWords.filter(
    (w: any) => !excludeWordIds.includes(w.wordId)
  );

  if (availableWords.length === 0) {
    return { success: false, error: "Nenhuma palavra disponível para esta rodada" };
  }

  const selectedWord = availableWords[Math.floor(Math.random() * availableWords.length)];

  const round = await prisma.round.create({
    data: {
      gameId,
      roundNumber,
      answerWordId: selectedWord.wordId,
      answerWord: selectedWord.wordText,
      wordOwnerId: selectedWord.userId,
      status: "ACTIVE",
    },
  });

  return { success: true, round };
}

/**
 * Submit an attempt for the current round.
 * The submitting user is always the currently authenticated user — never a
 * client-supplied id.
 */
export async function submitAttempt(
  roundId: string,
  attemptText: string
): Promise<{
  success: boolean;
  feedback?: Array<{ letter: string; status: string }>;
  isCorrect?: boolean;
  error?: string;
}> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  try {
    // Check rate limit for game attempts
    const rateLimit = await checkRateLimit(
      `game-attempt-${userId}`,
      RATE_LIMIT_CONFIGS.GAME_ATTEMPT
    );

    if (!rateLimit.allowed) {
      logger.warn("game", "Game attempt rate limit exceeded", { userId, roundId }, userId);
      return { success: false, error: rateLimit.message || "Aguarde antes de enviar outra tentativa" };
    }

    // Get round info
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: {
        game: {
          include: {
            room: {
              include: {
                participants: { where: { status: "ACTIVE" } },
              },
            },
          },
        },
      },
    });

    if (!round) {
      return { success: false, error: "Rodada não encontrada" };
    }

    if (round.status !== "ACTIVE") {
      return { success: false, error: "A rodada não está ativa" };
    }

    // Verify user is not the word owner (spectator)
    if (round.wordOwnerId === userId) {
      return { success: false, error: "Você não pode participar desta rodada (modo espectador)" };
    }

    // Validate word
    const wordValidation = await validateAttemptWord(attemptText, round.game.room.wordLength);
    if (!wordValidation.valid) {
      logger.warn("word", "Invalid word submitted", { userId, word: attemptText, reason: wordValidation.error }, userId);
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

    // A player who already solved the round, or already used every
    // attempt, is done — even while the round stays ACTIVE for other
    // players who haven't finished yet (see the round-completion check
    // below). Enforcing the cap here also closes a gap where nothing
    // previously stopped a player from submitting unlimited attempts.
    if (previousAttempts.some((a: any) => a.isCorrect)) {
      return { success: false, error: "Você já acertou esta rodada" };
    }
    if (attemptCount >= MAX_ATTEMPTS) {
      return { success: false, error: "Você já usou todas as suas tentativas nesta rodada" };
    }

    const normalizedWord = attemptText.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const normalizedPrevious = previousAttempts.map((a: any) =>
      a.attemptText.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    );

    if (normalizedPrevious.includes(normalizedWord)) {
      return { success: false, error: "Você já tentou esta palavra" };
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

    logger.info("game", "Tentativa enviada", { userId, roundId, attemptNumber: attemptCount + 1, isCorrect }, userId);

    // Score this attempt if it solved the round. This is per-player and
    // independent of whether the round as a whole is over yet — see below.
    if (isCorrect) {
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

      logger.info("game", "Jogador acertou a rodada", { userId, roundId, score: finalScore, attemptsUsed: attemptCount + 1 }, userId);
    }

    // The round only finishes once every active, non-spectator player has
    // either solved it or used all their attempts — a fast player is no
    // longer allowed to end the round for everyone else still guessing.
    const activePlayerIds = round.game.room.participants
      .map((p: any) => p.userId)
      .filter((id: string) => id !== round.wordOwnerId);

    const roundAttempts = await prisma.roundAttempt.findMany({
      where: { roundId, userId: { in: activePlayerIds } },
      select: { userId: true, isCorrect: true },
    });

    const attemptsByUser = new Map<string, { isCorrect: boolean }[]>();
    for (const a of roundAttempts) {
      const list = attemptsByUser.get(a.userId) ?? [];
      list.push(a);
      attemptsByUser.set(a.userId, list);
    }

    const allPlayersDone = haveAllPlayersFinishedRound(activePlayerIds, attemptsByUser);

    if (allPlayersDone) {
      // Atomic guard: only the request that actually flips the round from
      // ACTIVE to FINISHED proceeds to auto-advance the match. Two
      // players' final attempts can land close enough together that both
      // reads of "is everyone done?" come back true — without this,
      // both would call advanceGameInternal concurrently for the same
      // transition. (Game.roomId and Round[gameId,roundNumber] being
      // @unique already stop that from corrupting anything, but this
      // avoids relying on that as the only line of defense.)
      const roundFinishResult = await prisma.round.updateMany({
        where: { id: roundId, status: "ACTIVE" },
        data: { status: "FINISHED", endedAt: new Date() },
      });

      if (roundFinishResult.count > 0) {
        logger.info("game", "Rodada finalizada — todos os jogadores concluíram", { roundId, gameId: round.gameId }, userId);

        // Auto-advance: once a round is genuinely over for everyone,
        // there's no reason to make every player wait on the host to
        // click "Próxima Rodada"/"Finalizar Partida" — see
        // advanceGameInternal. A failure here doesn't affect this
        // player's own attempt, which already succeeded above.
        const advanceResult = await advanceGameInternal(round.gameId, userId);
        if (!advanceResult.success) {
          logger.error(
            "game",
            "Falha ao avançar automaticamente após o fim da rodada",
            new Error(advanceResult.error || "unknown"),
            { roundId, gameId: round.gameId },
            userId
          );
        }
      }
    }

    revalidatePath(`/game/${round.gameId}`);
    emitGameUpdate(round.gameId);

    return {
      success: true,
      feedback: feedback.map((f) => ({
        letter: f.letter,
        status: f.status,
      })),
      isCorrect,
    };
  } catch (error) {
    logger.error("game", "Erro ao enviar tentativa", error as Error, { userId, roundId }, userId);
    return { success: false, error: "Falha ao enviar tentativa" };
  }
}

/**
 * Get game state for a player.
 * The player is always the currently authenticated user — never a
 * client-supplied id, since it decides whether the secret answer word is
 * included in the response (spectator vs. active player).
 */
export async function getGameState(gameId: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

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
            // Fetch every attempt in the round (not just this caller's) so
            // the spectator branch below can build a live view of what
            // everyone else is doing. Non-spectator callers still only get
            // their own attempts back, via the ownAttempts filter — this
            // does not change what an active player sees.
            attempts: {
              include: {
                user: { select: { id: true, name: true, image: true } },
              },
              orderBy: { attemptNumber: "asc" },
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

    const ownAttempts = round.attempts.filter((a: any) => a.userId === userId);

    // The spectator's word is the round's answer, so seeing other players'
    // guesses (word + correctness pattern) doesn't expose anything they
    // don't already know — CLAUDE.md section 19 explicitly expects the
    // spectator to be able to follow along. Grouped per player so the UI
    // can render one board per active player.
    let othersProgress:
      | Array<{
          user: { id: string; name: string | null; image: string | null };
          attempts: typeof round.attempts;
        }>
      | undefined;

    if (isSpectator) {
      const byUser = new Map<string, typeof round.attempts>();
      for (const attempt of round.attempts) {
        const list = byUser.get(attempt.userId) ?? [];
        list.push(attempt);
        byUser.set(attempt.userId, list);
      }
      othersProgress = Array.from(byUser.values()).map((playerAttempts) => ({
        user: playerAttempts[0].user,
        attempts: playerAttempts,
      }));
    }

    // The answer is only safe to reveal once the round is truly over for
    // everyone (round.status flips to FINISHED only once every active
    // player has solved it or run out of attempts — see submitAttempt) —
    // before that, only the spectator (who submitted the word) may see it.
    const canRevealAnswer = isSpectator || round.status === "FINISHED";

    // Once the match itself is over, build the final placar: every player
    // who took part in the match, ranked by total score. This has to start
    // from the room's participant roster rather than just the MatchScore
    // rows — a player who never solved a single round still finished the
    // match with 0 points and a real (last) placement, and CLAUDE.md's
    // "PLACAR FINAL" section requires every player's placement, not just
    // the ones who scored.
    let matchResults:
      | Array<{
          userId: string;
          user: { id: string; name: string | null; image: string | null };
          finalScore: number;
          placement: number;
        }>
      | undefined;

    if (fullGame.status === "FINISHED") {
      const matchScores = await prisma.matchScore.findMany({ where: { gameId } });
      const scoreByUserId = new Map(matchScores.map((s: any) => [s.userId, s.finalScore]));

      const ranked = fullGame.room.participants
        .map((p: any) => ({
          userId: p.userId,
          user: p.user,
          finalScore: scoreByUserId.get(p.userId) ?? 0,
        }))
        .sort((a: any, b: any) => b.finalScore - a.finalScore);

      // Standard competition ranking: tied scores share a placement, and
      // the next distinct score resumes at (index + 1), not the next
      // integer — e.g. two players tied for 1st are both "1º", the next
      // player is "3º".
      let placement = 0;
      let previousScore: number | null = null;
      matchResults = ranked.map((entry: any, index: number) => {
        if (previousScore === null || entry.finalScore !== previousScore) {
          placement = index + 1;
          previousScore = entry.finalScore;
        }
        return { ...entry, placement };
      });
    }

    return {
      ...fullGame,
      rounds: [
        {
          ...round,
          attempts: ownAttempts,
          othersProgress,
          answerWord: canRevealAnswer ? round.answerWord : undefined,
        },
      ],
      isSpectator,
      matchResults,
    };
  } catch (error) {
    console.error("Error getting game state:", error);
    return null;
  }
}

/**
 * Get round info for the currently authenticated user.
 * The secret answer word is only included when the requester is the
 * spectator for this round (the player whose word is being used) — never
 * exposed to the players who are actively guessing.
 */
export async function getRoundInfo(roundId: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  try {
    const round = await prisma.round.findUnique({
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

    if (!round) {
      return null;
    }

    const isSpectator = round.wordOwnerId === userId;

    return {
      ...round,
      answerWord: isSpectator ? round.answerWord : undefined,
    };
  } catch (error) {
    console.error("Error getting round info:", error);
    return null;
  }
}

/**
 * Get the currently authenticated user's attempts in a round.
 */
export async function getUserAttempts(roundId: string) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return [];
  }

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
 * Shared core of round/match advancement. Used by both the host-triggered
 * advanceToNextRound Server Action and the automatic advancement that
 * fires the instant a round finishes (see submitAttempt) — the host's
 * "Próxima Rodada"/"Finalizar Partida" button is a manual fallback here,
 * not the only path: once every active player has actually finished a
 * round, there's no reason to make everyone wait on a click.
 */
async function advanceGameInternal(
  gameId: string,
  actorUserId?: string
): Promise<{ success: boolean; nextRoundId?: string; error?: string }> {
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { room: true },
    });

    if (!game) {
      return { success: false, error: "Jogo não encontrado" };
    }

    if (game.status === "FINISHED") {
      return { success: false, error: "Game is already finished" };
    }

    // The round only finishes on its own once every active player has
    // solved it or used all attempts (see submitAttempt) — nothing may
    // cut that short by advancing early and leaving others mid-guess.
    const currentRound = await prisma.round.findUnique({
      where: { gameId_roundNumber: { gameId, roundNumber: game.currentRound } },
      select: { status: true },
    });

    if (currentRound && currentRound.status !== "FINISHED") {
      return { success: false, error: "Aguarde todos os jogadores concluírem a rodada atual" };
    }

    const nextRoundNumber = game.currentRound + 1;

    if (nextRoundNumber > game.totalRounds) {
      // Game finished. Atomic guard: only the caller that actually flips
      // the game from non-FINISHED to FINISHED proceeds to finalize
      // statistics — Game has no unique constraint protecting against two
      // concurrent callers both reaching this branch (e.g. the automatic
      // trigger from submitAttempt and a host clicking "Finalizar Partida"
      // at nearly the same instant), and finalizeGameStatistics is *not*
      // idempotent — it increments totalGamesPlayed/totalPoints, so
      // running it twice for the same match would double-count.
      const finishResult = await prisma.game.updateMany({
        where: { id: gameId, status: { not: "FINISHED" } },
        data: { status: "FINISHED", endedAt: new Date() },
      });

      if (finishResult.count === 0) {
        return { success: false, error: "Game is already finished" };
      }

      await prisma.room.update({
        where: { id: game.roomId },
        data: {
          status: "FINISHED",
          gameEndedAt: new Date(),
        },
      });

      logger.info("game", "Jogo finalizado", { gameId, totalRounds: game.totalRounds }, actorUserId);

      // Compute each player's final placement and fold this match's result
      // into their global UserStatistics — without this the game record
      // marks itself FINISHED but the ranking/dashboard/profile never learn
      // it happened at all.
      const statsResult = await finalizeGameStatistics(gameId);
      if (!statsResult.success) {
        logger.error(
          "game",
          "Falha ao finalizar estatísticas do jogo",
          new Error(statsResult.error || "unknown"),
          { gameId },
          actorUserId
        );
      }

      emitGameUpdate(gameId);
      return { success: true };
    }

    // Select a different word than the ones already used in previous rounds
    const previousRounds = await prisma.round.findMany({
      where: { gameId },
      select: { answerWordId: true },
    });
    const usedWordIds = previousRounds.map((r: any) => r.answerWordId);

    const nextRound = await createRound(gameId, game.roomId, nextRoundNumber, usedWordIds);

    if (!nextRound.success || !nextRound.round) {
      return { success: false, error: nextRound.error || "No words available for next round" };
    }

    // Update game
    await prisma.game.update({
      where: { id: gameId },
      data: { currentRound: nextRoundNumber },
    });

    logger.info("game", "Nova rodada iniciada", { gameId, roundNumber: nextRoundNumber }, actorUserId);
    revalidatePath(`/game/${gameId}`);
    emitGameUpdate(gameId);

    return { success: true, nextRoundId: nextRound.round.id };
  } catch (error) {
    logger.error("game", "Erro ao avançar rodada", error as Error, { gameId }, actorUserId);
    return { success: false, error: "Falha ao avançar rodada" };
  }
}

/**
 * Advance to next round.
 * Only the host (the currently authenticated user, verified against the
 * room's hostId — never a client-supplied id) can advance manually — kept
 * as a fallback for the rare case where the automatic advancement (see
 * submitAttempt) doesn't fire for some reason.
 */
export async function advanceToNextRound(gameId: string): Promise<{
  success: boolean;
  nextRoundId?: string;
  error?: string;
}> {
  const session = await auth();
  const hostUserId = session?.user?.id;

  if (!hostUserId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { room: { select: { hostId: true } } },
  });

  if (!game) {
    return { success: false, error: "Jogo não encontrado" };
  }

  if (game.room.hostId !== hostUserId) {
    logger.warn("security", "Non-host attempted to advance round", { userId: hostUserId, gameId }, hostUserId);
    return { success: false, error: "Only the host can advance rounds" };
  }

  return advanceGameInternal(gameId, hostUserId);
}
