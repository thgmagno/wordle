import { auth } from "@/lib/auth";
import { getGameState } from "@/server/game-actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import GameBoardClient from "@/components/game-board-client";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const gameState = await getGameState(gameId);

  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
              Wordle
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Jogo não encontrado</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              A partida que você procura não existe ou não está mais disponível.
            </p>
            <Link href="/dashboard" className="btn-primary">
              Voltar para Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
              Wordle
            </Link>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Rodada {gameState.currentRound} de {gameState.totalRounds}
                </p>
                {gameState.isSpectator && (
                  <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                    👁️ Modo Espectador
                  </p>
                )}
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <GameBoardClient
          gameId={gameId}
          gameState={gameState}
          currentUserId={session.user.id || ""}
          isHost={gameState.room?.host?.id === session.user.id}
        />
      </main>
    </div>
  );
}
