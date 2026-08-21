import { prisma } from "@/lib/prisma";

export interface MatchPlacementEntry {
  userId: string;
  finalScore: number;
  placement: number;
}

/**
 * Compute each participant's final placement for a match, with a
 * deterministic tiebreaker for equal scores: whoever finished their last
 * round sooner (by wall-clock time) places above someone who reached the
 * same score but took longer — "quem terminou primeiro," the standard way
 * to break a Wordle-style tie. Without this, two players landing on the
 * exact same score both showed as "1º" with no way to tell them apart.
 *
 * Shared by getGameState (the player-facing "Placar Final") and
 * finalizeGameStatistics (win-counting for the global ranking) so what a
 * player sees as their placement and what actually gets credited as a win
 * in their UserStatistics always agree — before this was extracted, the
 * two computed placement independently and could disagree on ties.
 *
 * `participantUserIds` should be every participant who took part in the
 * match — not just whoever scored — so a player who never solved a single
 * round still gets a real (last) placement instead of being silently
 * dropped. Callers typically pass the room's currently-ACTIVE participant
 * list.
 */
export async function computeMatchPlacements(
  gameId: string,
  participantUserIds: string[],
): Promise<MatchPlacementEntry[]> {
  const matchScores = await prisma.matchScore.findMany({ where: { gameId } });
  const scoreByUserId = new Map<string, number>(
    matchScores.map((s: any) => [s.userId, s.finalScore]),
  );

  // Every attempt across every round of this match, not just the current
  // round — a finished game's "currentRound" is its last one, so a query
  // scoped to that round alone would miss earlier rounds' attempts and
  // undercount how long a player who wrapped up early actually took.
  const allAttempts = await prisma.roundAttempt.findMany({
    where: { round: { gameId } },
    select: { userId: true, createdAt: true },
  });

  const lastAttemptAtByUserId = new Map<string, number>();
  for (const attempt of allAttempts) {
    const t = attempt.createdAt.getTime();
    const prev = lastAttemptAtByUserId.get(attempt.userId);
    if (prev === undefined || t > prev) {
      lastAttemptAtByUserId.set(attempt.userId, t);
    }
  }

  const ranked = participantUserIds
    .map((userId) => ({
      userId,
      finalScore: scoreByUserId.get(userId) ?? 0,
      // A player with no recorded attempt at all (never got a chance to
      // guess, or the round they'd have played never happened) sorts last
      // among any tie — they didn't "finish" anything.
      lastAttemptAt: lastAttemptAtByUserId.get(userId) ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      return a.lastAttemptAt - b.lastAttemptAt;
    });

  let placement = 0;
  let previous: { finalScore: number; lastAttemptAt: number } | null = null;

  return ranked.map((entry, index) => {
    if (
      !previous ||
      entry.finalScore !== previous.finalScore ||
      entry.lastAttemptAt !== previous.lastAttemptAt
    ) {
      placement = index + 1;
      previous = entry;
    }
    return { userId: entry.userId, finalScore: entry.finalScore, placement };
  });
}
