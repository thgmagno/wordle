import Link from "next/link";
import { redirect } from "next/navigation";
import SinglePlayerBoardClient from "@/components/single-player-board-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth } from "@/lib/auth";
import { getSinglePlayerGameState } from "@/server/single-player-actions";

export default async function SinglePlayerGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const gameState = await getSinglePlayerGameState(gameId);

  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Link
              href="/dashboard"
              className="text-2xl font-bold text-blue-600"
            >
              Wordle
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Partida não encontrada</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              Esta partida solo não existe ou não pertence a você.
            </p>
            <Link href="/play" className="btn-primary">
              Jogar Modo Solo
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
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
            Wordle
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Modo Solo · {gameState.wordLength} letras
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <SinglePlayerBoardClient gameState={gameState} />
      </main>
    </div>
  );
}
