/**
 * Analytics API Endpoint
 *
 * POST /api/analytics
 * Recebe e armazena eventos de analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface AnalyticsEventPayload {
  type: string;
  userId?: string;
  data: Record<string, any>;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload: AnalyticsEventPayload = await request.json();

    // Validar payload
    if (!payload.type) {
      return NextResponse.json(
        { error: "Event type is required" },
        { status: 400 }
      );
    }

    // Armazenar evento de analytics (implementação simplificada)
    // Em produção, usar um banco de dados dedicado para analytics
    logger.info("performance", "Analytics event tracked", {
      eventType: payload.type,
      userId: payload.userId,
    });

    // Retornar sucesso
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("performance", "Failed to track analytics event", error as Error);
    return NextResponse.json(
      { error: "Failed to track event" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/game/[gameId]
 * Obter métricas de um jogo específico
 */
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.includes("/game/")) {
    const gameId = pathname.split("/game/")[1];

    try {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          rounds: {
            include: {
              attempts: true,
            },
          },
        },
      });

      if (!game) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
      }

      // Calcular métricas
      const totalAttempts = game.rounds.reduce(
        (sum: number, round: any) => sum + round.attempts.length,
        0
      );

      const metrics = {
        gameId: game.id,
        totalRounds: game.totalRounds,
        totalAttempts,
        averageAttemptsPerRound:
          game.rounds.length > 0
            ? totalAttempts / game.rounds.length
            : 0,
        duration: game.endedAt
          ? new Date(game.endedAt).getTime() -
            new Date(game.createdAt).getTime()
          : null,
        status: game.status,
      };

      return NextResponse.json(metrics);
    } catch (error) {
      logger.error("performance", "Failed to get game metrics", error as Error);
      return NextResponse.json(
        { error: "Failed to get metrics" },
        { status: 500 }
      );
    }
  }

  if (pathname.includes("/user/")) {
    const userId = pathname.split("/user/")[1];

    try {
      const stats = await prisma.userStatistics.findUnique({
        where: { userId },
      });

      if (!stats) {
        return NextResponse.json(
          { error: "User stats not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        userId,
        totalGamesPlayed: stats.totalGamesPlayed,
        totalWins: stats.totalWins,
        totalPoints: stats.totalPoints,
        averageScore: stats.averageScore,
        bestScore: stats.bestScore,
        winRate:
          stats.totalGamesPlayed > 0
            ? (stats.totalWins / stats.totalGamesPlayed) * 100
            : 0,
      });
    } catch (error) {
      logger.error(
        "performance",
        "Failed to get user metrics",
        error as Error
      );
      return NextResponse.json(
        { error: "Failed to get metrics" },
        { status: 500 }
      );
    }
  }

  if (pathname === "/api/analytics/global") {
    try {
      const [totalUsers, totalGames, participantCount] = await Promise.all([
        prisma.user.count(),
        prisma.game.count(),
        prisma.roomParticipant.count(),
      ]);

      return NextResponse.json({
        totalUsers,
        totalGames,
        avgPlayersPerGame:
          totalGames > 0
            ? (participantCount / totalGames).toFixed(2)
            : 0,
      });
    } catch (error) {
      logger.error(
        "performance",
        "Failed to get global metrics",
        error as Error
      );
      return NextResponse.json(
        { error: "Failed to get metrics" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
