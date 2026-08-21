import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { JoinRoomButton } from "@/components/join-room-button";
import { getUserStatistics } from "@/server/ranking-actions";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const stats = await getUserStatistics(session.user.id);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Wordle</h1>
          <div className="flex gap-4 items-center">
            <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
              Bem-vindo, {session.user.name}!
              {session.user.isGuest && (
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  Convidado
                </span>
              )}
            </span>
            <ThemeToggle />
            <Link href="/api/auth/signout" className="btn-secondary">
              Sair
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Painel de Controle</h2>

          {/* Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {/* Single Player */}
            <div className="card hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-2">Jogar Sozinho</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Jogue no seu ritmo, sem precisar de outros jogadores
              </p>
              <Link
                href="/play"
                className="btn-primary"
              >
                Modo Solo
              </Link>
            </div>

            {/* Create Room */}
            <div className="card hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-2">Criar Sala</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Crie uma nova sala multiplayer e convide seus amigos para jogar
              </p>
              <Link
                href="/room/create"
                className="btn-primary"
              >
                Criar Nova Sala
              </Link>
            </div>

            {/* Join Room */}
            <div className="card hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-2">Entrar em Sala</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Entre em uma sala existente usando o código da sala
              </p>
              <JoinRoomButton />
            </div>

            {/* Leaderboard */}
            <div className="card hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-2">Ranking Global</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Veja sua posição e compete com outros jogadores no ranking global
              </p>
              <Link
                href="/leaderboard"
                className="btn-primary"
              >
                Ver Ranking
              </Link>
            </div>

            {/* Profile */}
            <div className="card hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-2">Meu Perfil</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Veja suas estatísticas e configure suas preferências
              </p>
              <Link
                href="/profile"
                className="btn-primary"
              >
                Abrir Perfil
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card">
            <h3 className="text-xl font-semibold mb-6">Minhas Estatísticas</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {stats?.totalGamesPlayed ?? 0}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Partidas Jogadas
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {stats?.totalWins ?? 0}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Vitórias
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {stats?.totalPoints ?? 0}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Pontuação Total
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {stats && stats.totalGamesPlayed > 0 ? stats.bestScore : "-"}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Melhor Pontuação
                </p>
              </div>
            </div>

            {(!stats || stats.totalGamesPlayed === 0) && (
              <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
                Você ainda não jogou nenhuma partida.{" "}
                <Link href="/room/create" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Crie uma sala
                </Link>{" "}
                para começar.
              </p>
            )}
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
