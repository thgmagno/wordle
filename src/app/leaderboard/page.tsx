import { auth } from "@/lib/auth";
import { getGlobalRanking, getUserRankingPosition } from "@/server/ranking-actions";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default async function LeaderboardPage() {
  const session = await auth();

  const ranking = await getGlobalRanking(1, 50);
  let userPosition: number | null = null;

  if (session?.user) {
    userPosition = await getUserRankingPosition(session.user.id || "");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Wordle
          </Link>
          <nav className="flex gap-4 items-center">
            <ThemeToggle />
            {session ? (
              <Link href="/dashboard" className="btn-secondary">
                Painel
              </Link>
            ) : (
              <Link href="/auth/signin" className="btn-secondary">
                Entrar
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">🏆 Ranking Global</h1>

          {/* User's Position */}
          {session?.user && userPosition && (
            <div className="card mb-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                    Sua Posição
                  </p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    #{userPosition}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                    Você está vendo
                  </p>
                  <Link href="/profile" className="text-blue-600 dark:text-blue-400 hover:underline">
                    Seu Perfil
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Table */}
          <LeaderboardTable items={ranking.items} />

          {/* Pagination Info */}
          {ranking.items.length > 0 && (
            <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
              <p>
                Mostrando {ranking.items.length} de {ranking.total} jogadores
              </p>
              {ranking.hasMore && (
                <p className="mt-2 text-blue-600 dark:text-blue-400">
                  Mais jogadores disponíveis
                </p>
              )}
            </div>
          )}

          {/* Call to Action */}
          {!session && (
            <div className="mt-12 text-center card bg-blue-50 dark:bg-blue-900/20">
              <h3 className="text-lg font-semibold mb-4">Quer aparecer no ranking?</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Faça login para começar a jogar e competir globalmente
              </p>
              <Link href="/auth/signin" className="btn-primary">
                Fazer Login
              </Link>
            </div>
          )}
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
