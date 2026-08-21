import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { JoinRoomButton } from "@/components/join-room-button";
import { getUserStatistics } from "@/server/ranking-actions";
import { getActiveRoomForUser, getPublicRooms } from "@/server/room-actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { LeaveRoomButton } from "@/components/leave-room-button";
import { PublicRoomsRealtime } from "@/components/public-rooms-realtime";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const [stats, activeRoom] = await Promise.all([
    getUserStatistics(session.user.id),
    getActiveRoomForUser(),
  ]);

  // Only fetched when there's somewhere for it to actually lead: a user
  // already active in a room can't join another one (see the "Criar
  // Sala"/"Entrar em Sala" cards' own one-room-at-a-time guard below), so
  // browsing public rooms in that state would just be a dead end — skip
  // the query entirely rather than fetch a list with nothing useful to do.
  const publicRooms = activeRoom ? [] : await getPublicRooms();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header — stacks vertically below the "Wordle" logo on narrow
          screens instead of forcing everything onto one row: a long name
          plus the guest badge, theme toggle and "Sair" button together are
          wider than a phone screen, and squeezing them into a single
          `justify-between` row let the welcome text's wrapped second line
          collide visually with the logo next to it. `min-w-0` + `truncate`
          on the name keeps an extra-long name from doing the same thing
          even in the stacked mobile layout. */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold text-blue-600">Wordle</h1>
          <div className="flex flex-wrap gap-3 items-center justify-between sm:justify-end">
            <span className="min-w-0 text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <span className="truncate">Bem-vindo, {session.user.name}!</span>
              {session.user.isGuest && (
                <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  Convidado
                </span>
              )}
            </span>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <ThemeToggle />
              <Link href="/api/auth/signout" className="btn-secondary">
                Sair
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Painel de Controle</h2>

          {/* Current Room — a user who hit the browser's back button after
              joining/creating a room ends up back here with no link to it
              short of knowing the code by heart (the room itself has no
              way to reach the dashboard's attention). Shown first,
              highlighted, whenever the server considers them still
              active in a non-finished room — see getActiveRoomForUser. */}
          {activeRoom && (
            <div className="card mb-6 border-2 border-blue-500 dark:border-blue-400">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-xl font-semibold mb-1">Sala Atual</h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {activeRoom.status === "LOBBY"
                      ? "Aguardando jogadores"
                      : "Partida em andamento"}{" "}
                    · {activeRoom.wordLength} letras ·{" "}
                    {activeRoom.participantCount}{" "}
                    {activeRoom.participantCount === 1 ? "jogador" : "jogadores"}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                  <Link href={`/room/${activeRoom.code}`} className="btn-primary text-center">
                    Voltar para a Sala
                  </Link>
                  {/* Escape hatch for a match that's stuck (a player left
                      mid-round and nothing ever advances it — see
                      LeaveRoomButton's own comment) — without this, the
                      only way out was logging out and coming back as a
                      different guest account. */}
                  <LeaveRoomButton
                    roomCode={activeRoom.code}
                    confirmMessage="Deseja sair desta sala? Se a partida estiver em andamento, você não poderá voltar a ela."
                    className="btn-secondary text-center"
                  />
                </div>
              </div>
            </div>
          )}

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

            {/* Create Room — the server rejects a second room while
                already active in one (createRoom's one-room-at-a-time
                guard), so this offers the way out (leave first) instead
                of a button that would just fail. */}
            <div className="card hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-2">Criar Sala</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {activeRoom
                  ? "Você já está em uma sala. Saia dela para criar uma nova."
                  : "Crie uma nova sala multiplayer e convide seus amigos para jogar"}
              </p>
              {activeRoom ? (
                <Link href={`/room/${activeRoom.code}`} className="btn-secondary">
                  Ir para Minha Sala
                </Link>
              ) : (
                <Link href="/room/create" className="btn-primary">
                  Criar Nova Sala
                </Link>
              )}
            </div>

            {/* Join Room — same one-room-at-a-time restriction as above. */}
            <div className="card hover:shadow-lg transition-shadow">
              <h3 className="text-xl font-semibold mb-2">Entrar em Sala</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {activeRoom
                  ? "Você já está em uma sala. Saia dela para entrar em outra."
                  : "Entre em uma sala existente usando o código da sala"}
              </p>
              {activeRoom ? (
                <Link href={`/room/${activeRoom.code}`} className="btn-secondary">
                  Ir para Minha Sala
                </Link>
              ) : (
                <JoinRoomButton />
              )}
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

          {/* Live-refreshes the card below on any "public-rooms:update"
              (see emitPublicRoomsUpdate's callers) — mounted whenever the
              card itself *could* apply, not only while it's non-empty,
              so a room going public while this list is empty still makes
              the card appear without needing an F5. */}
          {!activeRoom && <PublicRoomsRealtime />}

          {/* Public Rooms — matchmaking-lite: rooms whose host opted into
              "Sala Pública" (see room/create and the lobby's own toggle)
              show up here for anyone to join without needing the code.
              Hidden entirely (not shown empty) whenever the user already
              has an active room — see publicRooms above — since joining
              another one would be blocked server-side anyway. */}
          {!activeRoom && publicRooms.length > 0 && (
            <div className="card mb-12">
              <h3 className="text-xl font-semibold mb-1">Salas Públicas</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Entre em uma sala aberta sem precisar de um código
              </p>
              <div className="space-y-3">
                {publicRooms.map((room) => (
                  <div
                    key={room.code}
                    className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {room.host.image && (
                        <img
                          src={room.host.image}
                          alt=""
                          className="w-8 h-8 rounded-full shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {room.host.name || "Anfitrião"}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {room.wordLength} letras · {room.participantCount}/
                          {room.maxPlayers} jogadores
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/room/${room.code}`}
                      className="btn-primary shrink-0 text-sm px-3 py-2"
                    >
                      Entrar
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

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

            {(!stats || stats.totalGamesPlayed === 0) && !activeRoom && (
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
