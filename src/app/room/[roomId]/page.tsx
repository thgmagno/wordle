import { auth } from "@/lib/auth";
import { getRoomInfo, joinRoom } from "@/server/room-actions";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import RoomLobbyClient from "@/components/room-lobby-client";
import { ThemeToggle } from "@/components/theme-toggle";

function RoomShell({ children }: { children: React.ReactNode }) {
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
        {children}
      </main>
    </div>
  );
}

function RoomUnavailable({
  title,
  message,
  activeRoomCode,
}: {
  title: string;
  message: string;
  // When set, this is specifically the "you're already in another room"
  // case — a direct link back to THAT room is far more useful here than
  // just a dashboard link, since it's the whole reason the user landed on
  // this screen in the first place (see CLAUDE.md's navigation feedback).
  activeRoomCode?: string;
}) {
  return (
    <RoomShell>
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">{message}</p>
        <div className="flex gap-3 justify-center flex-wrap">
          {activeRoomCode && (
            <Link href={`/room/${activeRoomCode}`} className="btn-primary">
              Voltar para Minha Sala
            </Link>
          )}
          <Link href="/dashboard" className={activeRoomCode ? "btn-secondary" : "btn-primary"}>
            Voltar para Dashboard
          </Link>
        </div>
      </div>
    </RoomShell>
  );
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const currentUserId = session.user.id;

  let room = await getRoomInfo(roomId);

  if (!room) {
    return (
      <RoomUnavailable
        title="Sala não encontrada"
        message="A sala que você procura não existe ou não está mais disponível."
      />
    );
  }

  // The server controls entry: a visitor who isn't a participant yet is
  // only added automatically while the room is still open (LOBBY) — never
  // for a room that already started or finished, and never trusting the
  // client to decide whether it "joined".
  const isParticipant = room.participants.some(
    (participant: any) => participant.userId === currentUserId
  );

  if (!isParticipant) {
    if (room.status !== "LOBBY") {
      return (
        <RoomUnavailable
          title="Sala não disponível"
          message="Esta sala já iniciou a partida ou foi encerrada, e você não fazia parte dela."
        />
      );
    }

    // This render can also happen as the implicit re-render Next.js
    // performs to produce a fresh RSC payload right after a Server Action
    // call from a client component on this very route (e.g. leaveRoom,
    // called from RoomLobbyClient) — not just on a genuine navigation to
    // this URL. Auto-joining in that case would immediately undo whatever
    // the action just did: a participant who just intentionally left would
    // be silently re-added as ACTIVE before their browser even finishes
    // navigating away. Next.js marks that kind of request with a
    // "next-action" header, which a plain page load never has — only
    // auto-join on a real navigation.
    const isServerActionRerender = (await headers()).has("next-action");

    if (isServerActionRerender) {
      return (
        <RoomUnavailable
          title="Você não está mais nesta sala"
          message="Atualize a página se acredita que isso é um erro."
        />
      );
    }

    const joinResult = await joinRoom(roomId);

    if (!joinResult.success) {
      return (
        <RoomUnavailable
          title="Não foi possível entrar na sala"
          message={joinResult.error || "A sala não está aceitando novos jogadores no momento."}
          activeRoomCode={joinResult.activeRoomCode}
        />
      );
    }

    const refreshed = await getRoomInfo(roomId);

    if (!refreshed) {
      return (
        <RoomUnavailable
          title="Sala não encontrada"
          message="A sala que você procura não existe ou não está mais disponível."
        />
      );
    }

    room = refreshed;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
            Wordle
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Código: <span className="font-mono font-semibold">{room.code}</span>
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      {/* room.code (not the raw roomId URL param) is what's passed down:
          it's the DB's canonical, already-uppercased form, so the client
          component's realtime socket channel and every server action call
          it makes stay consistent regardless of what casing the visitor
          typed into the URL bar. */}
      <main className="flex-1 container mx-auto px-4 py-12">
        <RoomLobbyClient roomId={room.code} room={room} currentUserId={currentUserId} />
      </main>
    </div>
  );
}
