import { auth } from "@/lib/auth";
import { getRoomInfo, joinRoom } from "@/server/room-actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import RoomLobbyClient from "@/components/room-lobby-client";

function RoomShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
            Wordle
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
        {children}
      </main>
    </div>
  );
}

function RoomUnavailable({ title, message }: { title: string; message: string }) {
  return (
    <RoomShell>
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">{message}</p>
        <Link href="/dashboard" className="btn-primary">
          Voltar para Dashboard
        </Link>
      </div>
    </RoomShell>
  );
}

export default async function RoomPage({ params }: { params: { roomId: string } }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const currentUserId = session.user.id;

  let room = await getRoomInfo(params.roomId);

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

    const joinResult = await joinRoom(params.roomId);

    if (!joinResult.success) {
      return (
        <RoomUnavailable
          title="Não foi possível entrar na sala"
          message={joinResult.error || "A sala não está aceitando novos jogadores no momento."}
        />
      );
    }

    const refreshed = await getRoomInfo(params.roomId);

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
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Sala: {params.roomId.substring(0, 8)}...
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12">
        <RoomLobbyClient roomId={params.roomId} room={room} currentUserId={currentUserId} />
      </main>
    </div>
  );
}
