/**
 * Admin Metrics API
 *
 * GET /api/admin/metrics
 * Retorna métricas agregadas para o dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação (implementar conforme necessário)
    const isAdmin = true; // TODO: verificar se usuário é admin

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Obter métricas
    const [
      totalUsers,
      totalGames,
      gamesByWordLength,
      dailyGames,
      popularWords,
    ] = await Promise.all([
      // Total de usuários
      prisma.user.count(),

      // Total de jogos
      prisma.game.count(),

      // Jogos por tamanho de palavra
      prisma.game.groupBy({
        by: ["id"],
        _count: true,
      }),

      // Jogos por dia (últimos 7 dias)
      getDailyGames(),

      // Palavras mais populares
      getMostPopularWords(),
    ]);

    // Calcular jogos por tamanho de palavra
    const wordLengthMap: Record<number, number> = { 4: 0, 5: 0, 6: 0 };
    for (const game of gamesByWordLength) {
      const room = await prisma.room.findFirst({
        where: { games: { some: { id: game.id } } },
      });
      if (room && room.wordLength) {
        wordLengthMap[room.wordLength]++;
      }
    }

    // Calcular jogadores médios por jogo
    const totalParticipants = await prisma.roomParticipant.count();
    const avgPlayersPerGame =
      totalGames > 0 ? totalParticipants / totalGames : 0;

    // Contar usuários online (últimos 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineUsers = await prisma.user.count({
      where: {
        // TODO: adicionar field lastActiveAt
      },
    });

    return NextResponse.json({
      totalUsers,
      totalGames,
      avgPlayersPerGame: avgPlayersPerGame.toFixed(2),
      onlineUsers: 0, // TODO: implementar rastreamento de online
      gamesByWordLength: wordLengthMap,
      dailyGames,
      popularWords,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      "performance",
      "Failed to fetch admin metrics",
      error as Error
    );
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}

/**
 * Obter jogos por dia (últimos 7 dias)
 */
async function getDailyGames() {
  const games = await prisma.game.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    select: { createdAt: true },
  });

  const grouped: Record<string, number> = {};

  // Agrupar por data
  for (const game of games) {
    const date = new Date(game.createdAt).toLocaleDateString();
    grouped[date] = (grouped[date] || 0) + 1;
  }

  // Converter para array
  return Object.entries(grouped).map(([date, count]) => ({
    date,
    count,
  }));
}

/**
 * Obter palavras mais populares
 */
async function getMostPopularWords() {
  const words = await prisma.submittedWord.groupBy({
    by: ["wordText"],
    _count: true,
    orderBy: { _count: { wordText: "desc" } },
    take: 10,
  });

  return words.map((w: any) => ({
    word: w.wordText,
    count: w._count.wordText,
  }));
}
