"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { computeMatchPlacements } from "@/lib/match-ranking";
import type { PaginatedResponse, UserStatistics } from "@/types";

/**
 * Get global ranking
 */
export async function getGlobalRanking(
  page: number = 1,
  limit: number = 50
): Promise<
  PaginatedResponse<{
    rank: number;
    user: { id: string; name: string | null; image: string | null };
    statistics: UserStatistics;
  }>
> {
  try {
    const skip = (page - 1) * limit;

    // Get total count
    // `isGuest: false` is defense in depth on top of `showInLeaderboard`
    // (guests always have that false too — see updateLeaderboardVisibility
    // and the Credentials provider in src/lib/auth.ts) — a guest should
    // never appear here even if some future bug ever let one end up with
    // showInLeaderboard: true.
    //
    // IMPORTANT — this filter silently excludes any User document that
    // predates the `isGuest` field's addition to the schema: Prisma's
    // `@default(false)` only applies at document-create time, it never
    // retroactively backfills existing MongoDB documents, and neither
    // `isGuest: false` nor `isGuest: { not: true }`/`NOT: { isGuest: true }`
    // match a document where the field is simply absent (verified — Prisma
    // requires the field to literally be present and satisfy the
    // comparison for this required-Boolean case on MongoDB, unlike a raw
    // `$ne` query, which would match a missing field). That's real, and it
    // silently dropped genuine pre-existing accounts from the entire
    // ranking. The actual fix is a one-time data backfill —
    // `npm run migrate:backfill-is-guest` (scripts/backfill-is-guest.js) —
    // that explicitly sets `isGuest: false` on every User document missing
    // it. Run that once per environment; this filter is correct for every
    // document going forward without it.
    const total = await prisma.userStatistics.count({
      where: {
        user: {
          showInLeaderboard: true,
          isGuest: false,
        },
      },
    });

    // Get rankings
    const rankings = await prisma.userStatistics.findMany({
      where: {
        user: {
          showInLeaderboard: true,
          isGuest: false,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
      // The third key (id) exists purely to break ties deterministically:
      // without it, two users tied on both totalPoints and averageScore
      // have no defined relative order, and MongoDB doesn't guarantee one
      // stays stable across queries. That non-determinism was also what
      // let this table's row order silently disagree with
      // getUserRankingPosition below — that function counts users
      // strictly ahead of a given user, so it needs the exact same
      // tie-break to ever agree with which row this ranking puts them in.
      orderBy: [{ totalPoints: "desc" }, { averageScore: "desc" }, { id: "asc" }],
      skip,
      take: limit,
    });

    const items = rankings.map((stat: any, index: number) => ({
      rank: skip + index + 1,
      user: stat.user,
      statistics: {
        id: stat.id,
        userId: stat.userId,
        totalGamesPlayed: stat.totalGamesPlayed,
        totalWins: stat.totalWins,
        totalPoints: stat.totalPoints,
        averageScore: stat.averageScore,
        bestScore: stat.bestScore,
        lastGamePlayedAt: stat.lastGamePlayedAt,
      },
    }));

    return {
      items,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  } catch (error) {
    console.error("Error getting global ranking:", error);
    return { items: [], total: 0, page, limit, hasMore: false };
  }
}

/**
 * Get user's ranking position
 */
export async function getUserRankingPosition(userId: string): Promise<number | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { showInLeaderboard: true },
    });

    if (!user?.showInLeaderboard) {
      return null;
    }

    const userStats = await prisma.userStatistics.findUnique({
      where: { userId },
    });

    if (!userStats) {
      return null;
    }

    // Must mirror getGlobalRanking's exact filter and ordering — including
    // the `isGuest: false` filter (see that function's comment — and
    // scripts/backfill-is-guest.js — for a real gap in what this can
    // match) and the `id` tie-break — or a user could see a "Sua Posição"
    // that doesn't match the row they actually appear on in that table, or
    // a count that includes people the table itself would exclude.
    const position = await prisma.userStatistics.count({
      where: {
        user: {
          showInLeaderboard: true,
          isGuest: false,
        },
        OR: [
          { totalPoints: { gt: userStats.totalPoints } },
          {
            AND: [
              { totalPoints: userStats.totalPoints },
              { averageScore: { gt: userStats.averageScore } },
            ],
          },
          {
            AND: [
              { totalPoints: userStats.totalPoints },
              { averageScore: userStats.averageScore },
              { id: { lt: userStats.id } },
            ],
          },
        ],
      },
    });

    return position + 1;
  } catch (error) {
    console.error("Error getting user ranking position:", error);
    return null;
  }
}

/**
 * Get user statistics
 */
export async function getUserStatistics(userId: string): Promise<UserStatistics | null> {
  try {
    const stats = await prisma.userStatistics.findUnique({
      where: { userId },
    });

    if (!stats) {
      // Create initial statistics if doesn't exist
      const newStats = await prisma.userStatistics.create({
        data: {
          userId,
          totalGamesPlayed: 0,
          totalWins: 0,
          totalPoints: 0,
          averageScore: 0,
          bestScore: 0,
        },
      });

      return {
        id: newStats.id,
        userId: newStats.userId,
        totalGamesPlayed: newStats.totalGamesPlayed,
        totalWins: newStats.totalWins,
        totalPoints: newStats.totalPoints,
        averageScore: newStats.averageScore,
        bestScore: newStats.bestScore,
        lastGamePlayedAt: newStats.lastGamePlayedAt,
      };
    }

    return {
      id: stats.id,
      userId: stats.userId,
      totalGamesPlayed: stats.totalGamesPlayed,
      totalWins: stats.totalWins,
      totalPoints: stats.totalPoints,
      averageScore: stats.averageScore,
      bestScore: stats.bestScore,
      lastGamePlayedAt: stats.lastGamePlayedAt,
    };
  } catch (error) {
    console.error("Error getting user statistics:", error);
    return null;
  }
}

/**
 * Get player profile.
 *
 * A user can always fetch their own profile (needed for the dashboard and
 * the profile page's own stats/settings). Fetching *someone else's*
 * profile — the public ranking modal — only succeeds when that user has
 * opted into `showInLeaderboard`; otherwise this returns null, same as if
 * the user didn't exist. This is what actually enforces "hidden users
 * never have their data revealed through the ranking modal" (CLAUDE.md
 * section 10) — the leaderboard query already excludes them from the
 * list, but without this check anyone who obtained a hidden user's id
 * could still fetch their stats directly by calling this action.
 */
export async function getPlayerProfile(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, image: true, showInLeaderboard: true },
    });

    if (!user) {
      return null;
    }

    if (!user.showInLeaderboard) {
      const session = await auth();
      const isOwnProfile = session?.user?.id === userId;

      if (!isOwnProfile) {
        return null;
      }
    }

    const stats = await getUserStatistics(userId);
    const rank = await getUserRankingPosition(userId);

    return {
      user,
      statistics: stats,
      rank,
    };
  } catch (error) {
    console.error("Error getting player profile:", error);
    return null;
  }
}

/**
 * Update user leaderboard visibility.
 * Always applies to the currently authenticated user — never a
 * client-supplied id, so one user can never change another's privacy
 * setting.
 */
export async function updateLeaderboardVisibility(
  showInLeaderboard: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  // A guest ("Entrar sem conta") is never allowed into the global ranking
  // — enforced again here, not just by defaulting showInLeaderboard to
  // false at creation and hiding the toggle in the profile UI, so a
  // forged call to this Server Action can't flip it on regardless of
  // what the client sends.
  if (session.user.isGuest) {
    logger.warn(
      "security",
      "Guest attempted to change leaderboard visibility",
      { userId },
      userId
    );
    return { success: false, error: "Convidados não participam do ranking" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { showInLeaderboard },
    });

    logger.info("security", "Leaderboard visibility updated", { userId, showInLeaderboard }, userId);
    return { success: true };
  } catch (error) {
    logger.error("security", "Error updating leaderboard visibility", error as Error, { userId, showInLeaderboard }, userId);
    return { success: false, error: "Falha ao atualizar visibilidade do ranking" };
  }
}

/**
 * Finalize game statistics
 * Called after a game ends
 */
export async function finalizeGameStatistics(
  gameId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        room: {
          select: {
            participants: {
              where: { status: "ACTIVE" },
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!game) {
      return { success: false, error: "Jogo não encontrado" };
    }

    const participantUserIds = game.room.participants.map((p: { userId: string }) => p.userId);

    if (participantUserIds.length === 0) {
      return { success: false, error: "Nenhum participante encontrado para este jogo" };
    }

    // Every participant, not just whoever has a MatchScore row — a
    // player who never solved a single round still finished the match
    // with 0 points and a real (last) placement, and used to be silently
    // skipped here entirely: their totalGamesPlayed never incremented,
    // and they'd never show up in the global ranking even after playing.
    // Same tiebreak (who finished last-round soonest) as the player-
    // facing "Placar Final" in getGameState, so a placement/win recorded
    // here always agrees with what the player actually saw on screen.
    const placements = await computeMatchPlacements(gameId, participantUserIds);

    for (const entry of placements) {
      const { userId, finalScore, placement } = entry;

      // Only write a MatchScore.placement for players who actually have a
      // MatchScore row (i.e. solved at least one round) — a 0-scorer has
      // no row to update, and there's nothing meaningful to set anyway.
      await prisma.matchScore
        .update({
          where: { gameId_userId: { gameId, userId } },
          data: { placement },
        })
        .catch(() => {
          // No MatchScore row for this user (0-scorer) — nothing to update.
        });

      // Update user statistics. This must upsert, not conditionally update:
      // a player's UserStatistics row is otherwise only ever created lazily
      // the first time they open the dashboard (see getUserStatistics), so
      // a first-time player who goes straight from signing in into a game
      // would have no row yet — a plain "update if exists" would silently
      // drop their very first match's result instead of recording it.
      const stats = await prisma.userStatistics.findUnique({
        where: { userId },
      });

      const isWin = placement === 1 ? 1 : 0;
      const newTotal = (stats?.totalGamesPlayed ?? 0) + 1;
      const newPoints = (stats?.totalPoints ?? 0) + finalScore;
      const newWins = (stats?.totalWins ?? 0) + isWin;
      const newAverageScore = newPoints / newTotal;
      const newBestScore = Math.max(stats?.bestScore ?? 0, finalScore);

      await prisma.userStatistics.upsert({
        where: { userId },
        update: {
          totalGamesPlayed: newTotal,
          totalWins: newWins,
          totalPoints: newPoints,
          averageScore: newAverageScore,
          bestScore: newBestScore,
          lastGamePlayedAt: new Date(),
        },
        create: {
          userId,
          totalGamesPlayed: newTotal,
          totalWins: newWins,
          totalPoints: newPoints,
          averageScore: newAverageScore,
          bestScore: newBestScore,
          lastGamePlayedAt: new Date(),
        },
      });

      logger.info(
        "game",
        "Estatísticas finalizadas para usuário",
        {
          gameId,
          userId,
          placement,
          score: finalScore,
          totalGamesPlayed: newTotal,
          totalPoints: newPoints,
          totalWins: newWins,
        },
        userId
      );
    }

    return { success: true };
  } catch (error) {
    logger.error("game", "Erro ao finalizar estatísticas", error as Error, { gameId }, undefined);
    return { success: false, error: "Falha ao finalizar estatísticas" };
  }
}
