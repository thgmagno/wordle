import { auth } from "@/lib/auth";
import { getRoomInfo } from "@/server/room-actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import RoomLobbyClient from "@/components/room-lobby-client";

export default async function RoomPage({ params }: { params: { roomId: string } }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const room = await getRoomInfo(params.roomId);

  if (!room) {
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
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Sala não encontrada</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              A sala que você procura não existe ou não está mais disponível.
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
        <RoomLobbyClient
          roomId={params.roomId}
          room={room}
          currentUserId={session.user.id || ""}
        />
      </main>
    </div>
  );
}
