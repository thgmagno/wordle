"use client";

import { useState, useEffect, useRef } from "react";
import { submitWord, startGame, leaveRoom } from "@/server/room-actions";
import { validateAnswerWordAction } from "@/server/word-actions";
import { useRoomRealtime } from "@/lib/use-realtime";
import { RoomCodeShare } from "@/components/room-code-share";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RoomInfo {
  id: string;
  hostId: string;
  status: string;
  wordLength: number;
  maxPlayers: number;
  participantCount: number;
  host: { id: string; name: string | null; image: string | null };
  participants: any[];
  wordSubmittedBy: string[];
  gameId: string | null;
}

export default function RoomLobbyClient({
  roomId,
  room,
  currentUserId,
}: {
  roomId: string;
  room: RoomInfo;
  currentUserId: string;
}) {
  const router = useRouter();
  const suppressRealtimeRefreshRef = useRef(false);
  useRoomRealtime(roomId, suppressRealtimeRefreshRef);

  // Once the host starts the match, room.gameId becomes available. Players
  // other than the host only learn about this through a realtime refresh
  // (see useRoomRealtime), so navigate them straight to the game instead of
  // leaving them to notice and click a link manually.
  useEffect(() => {
    if (room.status === "IN_PROGRESS" && room.gameId) {
      router.push(`/game/${room.gameId}`);
    }
  }, [room.status, room.gameId, router]);

  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmittedWord, setHasSubmittedWord] = useState(
    room.wordSubmittedBy.includes(currentUserId)
  );
  const isHost = room.hostId === currentUserId;

  const handleSubmitWord = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      // First validate the word
      const validation = await validateAnswerWordAction(word, room.wordLength);

      if (!validation.valid) {
        setError(validation.error || "Palavra inválida");
        setIsLoading(false);
        return;
      }

      // Then submit it
      const result = await submitWord(roomId, validation.wordId || "", word);

      if (result.success) {
        setSuccess("Palavra enviada com sucesso!");
        setWord("");
        setHasSubmittedWord(true);
      } else {
        setError(result.error || "Erro ao enviar palavra");
      }
    } catch (err) {
      setError("Erro ao validar palavra");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGame = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await startGame(roomId);

      if (result.success && result.gameId) {
        router.push(`/game/${result.gameId}`);
      } else {
        setError(result.error || "Erro ao iniciar jogo");
      }
    } catch (err) {
      setError("Erro ao iniciar jogo");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (confirm("Deseja sair da sala?")) {
      // Set before calling leaveRoom: its own realtime broadcast can reach
      // this same client before the navigation below unmounts it (see
      // useRoomRealtime's suppressRefreshRef doc) — without this, that
      // self-triggered refresh would re-run RoomPage's auto-join and
      // silently put this player right back into the room they just left.
      suppressRealtimeRefreshRef.current = true;
      setIsLoading(true);
      try {
        await leaveRoom(roomId);
        router.push("/dashboard");
      } catch (err) {
        suppressRealtimeRefreshRef.current = false;
        setError("Erro ao sair da sala");
        setIsLoading(false);
      }
    }
  };

  const allPlayersSubmitted =
    room.participantCount > 0 && room.wordSubmittedBy.length === room.participantCount;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar - Room Info */}
        <div className="lg:col-span-1">
          {/* Room Details */}
          <div className="card mb-6">
            <h3 className="text-lg font-semibold mb-4">Informações da Sala</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-600 dark:text-slate-400">Código da Sala</p>
                <p className="font-mono text-lg font-bold tracking-widest bg-slate-100 dark:bg-slate-700 p-2 rounded text-center">
                  {roomId}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Compartilhe este código para outros jogadores entrarem.
                </p>
                <RoomCodeShare code={roomId} />
              </div>
              <div>
                <p className="text-slate-600 dark:text-slate-400">Tamanho da Palavra</p>
                <p className="text-lg font-bold text-blue-600">{room.wordLength} letras</p>
              </div>
              <div>
                <p className="text-slate-600 dark:text-slate-400">Anfitrião</p>
                <p className="font-semibold">{room.host.name || "Desconhecido"}</p>
              </div>
              <div>
                <p className="text-slate-600 dark:text-slate-400">Status da Sala</p>
                <p className="font-semibold">
                  {room.status === "LOBBY" ? "Aguardando..." : "Em Progresso"}
                </p>
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">
              Participantes ({room.participantCount}/{room.maxPlayers})
            </h3>
            <div className="space-y-2">
              {room.participants.map((participant: any) => (
                <div
                  key={participant.userId}
                  className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700 rounded"
                >
                  {participant.user.image && (
                    <img
                      src={participant.user.image}
                      alt={participant.user.name}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      {participant.user.name || "Usuário"}
                    </p>
                  </div>
                  {room.wordSubmittedBy.includes(participant.userId) && (
                    <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 px-2 py-1 rounded">
                      ✓ Palavra enviada
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content - Word Submission */}
        <div className="lg:col-span-2">
          {room.status === "LOBBY" ? (
            <>
              {/* Word Submission Form */}
              {!hasSubmittedWord && (
                <div className="card mb-6">
                  <h3 className="text-2xl font-semibold mb-6">Envie sua Palavra Secreta</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6">
                    Escolha uma palavra com exatamente {room.wordLength} letras em português.
                    Esta será a palavra que os outros jogadores tentarão descobrir em uma das rodadas.
                  </p>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-4">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg mb-4">
                      {success}
                    </div>
                  )}

                  <form onSubmit={handleSubmitWord} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Palavra</label>
                      <input
                        type="text"
                        value={word}
                        onChange={(e) => setWord(e.target.value)}
                        maxLength={room.wordLength}
                        placeholder={`Digite uma palavra com ${room.wordLength} letras`}
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoading}
                      />
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {word.length}/{room.wordLength}
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || word.length !== room.wordLength}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
                    >
                      {isLoading ? "Enviando..." : "Enviar Palavra"}
                    </button>
                  </form>
                </div>
              )}

              {hasSubmittedWord && (
                <div className="card mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <h3 className="text-2xl font-semibold mb-2 text-green-800 dark:text-green-300">
                    ✓ Palavra Enviada
                  </h3>
                  <p className="text-green-700 dark:text-green-400">
                    Sua palavra foi registrada. Aguarde os demais participantes.
                  </p>
                </div>
              )}

              {/* Start Game Button (Host Only). The match actually starts
                  automatically the instant every participant has a word in
                  (see submitWord's auto-start) — this button is a manual
                  fallback for the rare case that doesn't fire, so it's
                  expected to rarely need clicking in practice. */}
              {isHost && (
                <div className="card mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <h3 className="text-lg font-semibold mb-4 text-blue-800 dark:text-blue-300">
                    Controles do Anfitrião
                  </h3>

                  {!allPlayersSubmitted ? (
                    <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
                      Aguardando {room.participantCount - room.wordSubmittedBy.length} participante(s)
                      para enviar palavras... A partida começa automaticamente assim que todos enviarem.
                    </p>
                  ) : (
                    <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
                      Todos enviaram suas palavras — a partida vai começar em instantes.
                    </p>
                  )}

                  <button
                    onClick={handleStartGame}
                    disabled={
                      isLoading ||
                      !allPlayersSubmitted ||
                      room.participantCount < 2
                    }
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Iniciando..." : "Iniciar Partida Agora"}
                  </button>

                  {room.participantCount < 2 && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                      Mínimo de 2 participantes necessários
                    </p>
                  )}
                </div>
              )}

              {/* Leave Room Button */}
              <button
                onClick={handleLeaveRoom}
                disabled={isLoading}
                className="w-full bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 disabled:opacity-50 text-slate-900 dark:text-white font-semibold py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                Sair da Sala
              </button>
            </>
          ) : (
            <div className="card">
              <h3 className="text-2xl font-semibold mb-4">Partida em Progresso</h3>
              <p className="text-slate-600 dark:text-slate-400">
                {room.gameId
                  ? "Esta partida já começou. Você será redirecionado para o jogo."
                  : "Esta partida já começou, mas a rodada ainda está sendo preparada."}
              </p>
              {room.gameId && (
                <div className="mt-6">
                  <Link href={`/game/${room.gameId}`} className="btn-primary">
                    Ir para o Jogo
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
