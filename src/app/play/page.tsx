import Link from "next/link";
import { redirect } from "next/navigation";
import SinglePlayerStartClient from "@/components/single-player-start-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth } from "@/lib/auth";
import {
  getActiveSinglePlayerGame,
  getSinglePlayerStatistics,
} from "@/server/single-player-actions";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
        {value}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
    </div>
  );
}

export default async function PlayPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const [activeGame, stats] = await Promise.all([
    getActiveSinglePlayerGame(),
    getSinglePlayerStatistics(session.user.id),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
            Wordle
          </Link>
          <span className="text-slate-600 dark:text-slate-400">
            / Modo Solo
          </span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-center">Modo Solo</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8 text-center">
            Jogue sozinho, no seu ritmo, quantas vezes quiser.
          </p>

          {/* Statistics */}
          <div className="card mb-8">
            <h2 className="text-lg font-semibold mb-6">Suas Estatísticas</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Partidas" value={stats?.totalGamesPlayed ?? 0} />
              <Stat label="Vitórias" value={stats?.totalWins ?? 0} />
              <Stat label="Sequência Atual" value={stats?.currentStreak ?? 0} />
              <Stat label="Melhor Sequência" value={stats?.bestStreak ?? 0} />
            </div>
          </div>

          <SinglePlayerStartClient activeGame={activeGame} />

          {/* Back Button */}
          <div className="mt-8 text-center">
            <Link
              href="/dashboard"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Voltar ao Painel
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>© 2026 Wordle. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
