"use server";

import { prisma } from "@/lib/prisma";
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
    const total = await prisma.userStatistics.count({
      where: {
        user: {
          showInLeaderboard: true,
        },
      },
    });

    // Get rankings
    const rankings = await prisma.userStatistics.findMany({
      where: {
        user: {
          showInLeaderboard: true,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: [{ totalPoints: "desc" }, { averageScore: "desc" }],
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

    const position = await prisma.userStatistics.count({
      where: {
        user: {
          showInLeaderboard: true,
        },
        OR: [
          { totalPoints: { gt: userStats.totalPoints } },
          {
            AND: [
              { totalPoints: userStats.totalPoints },
              { averageScore: { gt: userStats.averageScore } },
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
 * Get player profile
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
 * Update user leaderboard visibility
 */
export async function updateLeaderboardVisibility(
  userId: string,
  showInLeaderboard: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { showInLeaderboard },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating leaderboard visibility:", error);
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
    // Get game and match scores
    const matchScores = await prisma.matchScore.findMany({
      where: { gameId },
      include: {
        user: true,
      },
      orderBy: { finalScore: "desc" },
    });

    if (matchScores.length === 0) {
      return { success: false, error: "Nenhuma pontuação encontrada para este jogo" };
    }

    // Update user statistics
    for (let i = 0; i < matchScores.length; i++) {
      const score = matchScores[i];
      const placement = i + 1;

      // Update placement
      await prisma.matchScore.update({
        where: { id: score.id },
        data: { placement },
      });

      // Update user statistics
      const stats = await prisma.userStatistics.findUnique({
        where: { userId: score.userId },
      });

      if (stats) {
        const newTotal = stats.totalGamesPlayed + 1;
        const newPoints = stats.totalPoints + score.finalScore;
        const isWin = placement === 1 ? 1 : 0;
        const newWins = stats.totalWins + isWin;
        const newAverageScore = newPoints / newTotal;
        const newBestScore = Math.max(stats.bestScore, score.finalScore);

        await prisma.userStatistics.update({
          where: { userId: score.userId },
          data: {
            totalGamesPlayed: newTotal,
            totalWins: newWins,
            totalPoints: newPoints,
            averageScore: newAverageScore,
            bestScore: newBestScore,
            lastGamePlayedAt: new Date(),
          },
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error finalizing game statistics:", error);
    return { success: false, error: "Falha ao finalizar estatísticas" };
  }
}
