import { auth } from "@/lib/auth";
import { getPlayerProfile } from "@/server/ranking-actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileClient from "@/components/profile-client";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const userId = session.user.id;
  const profile = await getPlayerProfile(userId);
  const stats = profile?.statistics ?? null;
  const rankPosition = profile?.rank ?? null;
  const showInLeaderboard = profile?.user.showInLeaderboard ?? true;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
            Wordle
          </Link>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Meu Perfil
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="card mb-8">
            <div className="flex items-center gap-6">
              {session.user.image && (
                <img
                  src={session.user.image}
                  alt={session.user.name || "Usuário"}
                  className="w-24 h-24 rounded-full"
                />
              )}
              <div>
                <h1 className="text-3xl font-bold mb-2">{session.user.name}</h1>
                <p className="text-slate-600 dark:text-slate-400 mb-2">
                  {session.user.email}
                </p>
                {rankPosition && (
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    Posição no Ranking: #{rankPosition}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Statistics */}
            <div className="lg:col-span-2">
              <div className="card mb-6">
                <h2 className="text-2xl font-bold mb-6">Estatísticas Gerais</h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                      {stats?.totalGamesPlayed || 0}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Partidas
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                      {stats?.totalWins || 0}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Vitórias
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                      {stats?.totalPoints || 0}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Pontos
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                      {stats?.bestScore || 0}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Melhor
                    </p>
                  </div>
                </div>

                {stats && stats.totalGamesPlayed && stats.totalGamesPlayed > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                          Taxa de Vitória
                        </p>
                        <p className="text-2xl font-bold">
                          {(
                            ((stats.totalWins || 0) / stats.totalGamesPlayed) *
                            100
                          ).toFixed(1)}
                          %
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                          Pontuação Média
                        </p>
                        <p className="text-2xl font-bold">
                          {(stats.averageScore || 0).toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {(!stats || !stats.totalGamesPlayed) && (
                  <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                    <p>Você ainda não jogou nenhuma partida.</p>
                    <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline">
                      Criar uma sala e começar
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Settings */}
            <div>
              <div className="card">
                <h2 className="text-2xl font-bold mb-6">Configurações</h2>

                <ProfileClient initialShowInLeaderboard={showInLeaderboard} />
              </div>
            </div>
          </div>

          {/* Back Button */}
          <div className="mt-8 text-center">
            <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 hover:underline">
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
