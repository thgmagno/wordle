import { auth } from "@/lib/auth";
import { getGameState } from "@/server/game-actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import GameBoardClient from "@/components/game-board-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { LeaveRoomButton } from "@/components/leave-room-button";

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
      {/* Header — kept compact (py-2 on mobile) so it doesn't eat into the
          vertical space the board/keyboard need to fit without scrolling. */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-2 sm:py-4">
          <div className="flex justify-between items-center">
            <Link href="/dashboard" className="text-lg sm:text-2xl font-bold text-blue-600">
              Wordle
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {gameState.status === "FINISHED"
                    ? "Partida encerrada"
                    : `Rodada ${gameState.currentRound} de ${gameState.totalRounds}`}
                </p>
                {gameState.isSpectator && gameState.status !== "FINISHED" && (
                  <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                    👁️ Modo Espectador
                  </p>
                )}
              </div>
              {/* Escape hatch for a match stuck ACTIVE forever (a player
                  disconnected mid-round and nothing ever advances it — see
                  LeaveRoomButton's own comment). Hidden once FINISHED: the
                  end-of-match screen already has its own way back to the
                  dashboard, and the room stops counting as "active" then
                  anyway. */}
              {gameState.status !== "FINISHED" && gameState.room?.code && (
                <LeaveRoomButton
                  roomCode={gameState.room.code}
                  label="Sair"
                  loadingLabel="..."
                  confirmMessage="Deseja sair da partida? Você não poderá voltar a esta rodada."
                  className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1"
                />
              )}
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-2 sm:py-8 max-w-2xl flex flex-col justify-center">
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
