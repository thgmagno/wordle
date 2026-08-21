"use client";

import { useState, useEffect, useRef } from "react";
import {
  submitWord,
  startGame,
  leaveRoom,
  changeRoomWordLength,
  changeRoomVisibility,
} from "@/server/room-actions";
import {
  validateAnswerWordAction,
  getRandomWordSuggestionAction,
} from "@/server/word-actions";
import { useRoomRealtime } from "@/lib/use-realtime";
import { RoomCodeShare } from "@/components/room-code-share";
import { WordLengthSlider } from "@/components/word-length-slider";
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
  isPublic: boolean;
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
  const [isShuffling, setIsShuffling] = useState(false);
  const isHost = room.hostId === currentUserId;

  // Derived, not local state: this has to track `room.wordSubmittedBy`
  // directly rather than being "set once on my own successful submit and
  // never touched again," because it's not only ever set by MY action —
  // the host changing the room's word length (see handleChangeWordLength)
  // clears EVERY participant's submission, including one they'd already
  // made. A local-only flag would keep showing "✓ Palavra Enviada" to a
  // player whose submission the host just wiped, with no way for them to
  // notice they need to send a new one.
  const hasSubmittedWord = room.wordSubmittedBy.includes(currentUserId);

  // Host-only word length control (see handleChangeWordLength). Local
  // draft value for the slider, resynced from the room's real value
  // whenever it changes — including a change this same host just made,
  // once it round-trips back through fresh props — so the slider never
  // drifts from what's actually saved.
  const [pendingWordLength, setPendingWordLength] = useState(room.wordLength);
  const [isChangingLength, setIsChangingLength] = useState(false);
  const [lengthError, setLengthError] = useState<string | null>(null);

  // Host-only visibility toggle (see handleToggleVisibility below).
  const [isChangingVisibility, setIsChangingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  useEffect(() => {
    setPendingWordLength(room.wordLength);
  }, [room.wordLength]);

  // "Sortear" button: fills the field with a random dictionary word so the
  // player can keep re-rolling until one feels right, instead of having to
  // think of a word from scratch. Purely a client-side convenience — the
  // suggestion still goes through the exact same validate-then-submit path
  // as anything typed by hand, so this has no special trust attached to it.
  const handleShuffleWord = async () => {
    setError(null);
    setSuccess(null);
    setIsShuffling(true);

    try {
      const result = await getRandomWordSuggestionAction(room.wordLength);

      if (result.success && result.word) {
        setWord(result.word);
      } else {
        setError(result.error || "Erro ao sortear palavra");
      }
    } catch (err) {
      setError("Erro ao sortear palavra");
      console.error(err);
    } finally {
      setIsShuffling(false);
    }
  };

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

  // Host-only: changes the room's word length before the match starts.
  // Anyone who already submitted a word (including the host) loses it —
  // it was validated against the OLD length and can't be valid for the
  // new one — so this always confirms first, but only mentions that cost
  // when there's actually something to lose.
  const handleChangeWordLength = async () => {
    if (pendingWordLength === room.wordLength) {
      return;
    }

    if (
      room.wordSubmittedBy.length > 0 &&
      !confirm(
        "Alterar o tamanho da palavra vai apagar as palavras já enviadas. Cada participante precisará enviar novamente. Continuar?"
      )
    ) {
      return;
    }

    setIsChangingLength(true);
    setLengthError(null);

    try {
      const result = await changeRoomWordLength(roomId, pendingWordLength);

      if (!result.success) {
        setLengthError(result.error || "Erro ao alterar o tamanho da palavra");
        // Snap the slider back to the room's real value — a failed change
        // (e.g. the rate limit) shouldn't leave the control showing a
        // value that was never actually saved.
        setPendingWordLength(room.wordLength);
      }
    } catch (err) {
      setLengthError("Erro ao alterar o tamanho da palavra");
      setPendingWordLength(room.wordLength);
      console.error(err);
    } finally {
      setIsChangingLength(false);
    }
  };

  // Host-only: toggles whether the room shows up in other players'
  // "Salas Públicas" browser (see changeRoomVisibility). Unlike the word
  // length above, flipping this never invalidates anything already in the
  // room, so it applies immediately on click — no separate confirm/apply
  // step needed.
  const handleToggleVisibility = async () => {
    setIsChangingVisibility(true);
    setVisibilityError(null);

    try {
      const result = await changeRoomVisibility(roomId, !room.isPublic);
      if (!result.success) {
        setVisibilityError(result.error || "Erro ao alterar a visibilidade da sala");
      }
    } catch (err) {
      setVisibilityError("Erro ao alterar a visibilidade da sala");
      console.error(err);
    } finally {
      setIsChangingVisibility(false);
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
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold">Palavra</label>
                        <button
                          type="button"
                          onClick={handleShuffleWord}
                          disabled={isLoading || isShuffling}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isShuffling ? "Sorteando..." : "🎲 Sortear palavra"}
                        </button>
                      </div>
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

                  {/* Word length can still be changed here, after the room
                      already exists — creating a new room just to pick a
                      different length used to be the only option. Changing
                      it clears any words already submitted (see
                      handleChangeWordLength), so this is deliberately not
                      auto-saved on every drag — the host reviews the new
                      value and confirms with a separate click. */}
                  <div className="mb-6 pb-6 border-b border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">
                      Tamanho da Palavra
                    </p>
                    <WordLengthSlider
                      value={pendingWordLength}
                      onChange={setPendingWordLength}
                      disabled={isChangingLength}
                    />

                    {lengthError && (
                      <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                        {lengthError}
                      </div>
                    )}

                    {room.wordSubmittedBy.length > 0 && pendingWordLength !== room.wordLength && (
                      <p className="text-xs text-orange-700 dark:text-orange-400 mt-3">
                        ⚠️ Isso vai apagar as {room.wordSubmittedBy.length}{" "}
                        {room.wordSubmittedBy.length === 1 ? "palavra já enviada" : "palavras já enviadas"} — cada
                        participante precisará enviar novamente.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleChangeWordLength}
                      disabled={isChangingLength || pendingWordLength === room.wordLength}
                      className="w-full sm:w-auto mt-3 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isChangingLength ? "Atualizando..." : "Atualizar Tamanho"}
                    </button>
                  </div>

                  {/* Visibility toggle — unlike word length above, this
                      applies immediately on click (see
                      handleToggleVisibility): flipping it never
                      invalidates anything already submitted. */}
                  <div className="mb-6 pb-6 border-b border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
                          Sala Pública
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          {room.isPublic
                            ? "Visível no painel de qualquer jogador, sem precisar do código."
                            : "Só quem tiver o código pode entrar."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleVisibility}
                        disabled={isChangingVisibility}
                        aria-pressed={room.isPublic}
                        className={`shrink-0 px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          room.isPublic
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
                        }`}
                      >
                        {isChangingVisibility
                          ? "Alterando..."
                          : room.isPublic
                            ? "Pública"
                            : "Privada"}
                      </button>
                    </div>

                    {visibilityError && (
                      <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                        {visibilityError}
                      </div>
                    )}
                  </div>

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

          {/* Leave Room Button — kept outside the LOBBY-only branch above
              and always rendered regardless of room.status: a match stuck
              IN_PROGRESS (e.g. a player disconnected mid-round and nothing
              ever advances it — see LeaveRoomButton's own comment) used to
              leave whoever landed on this screen with no way out at all,
              since the branch above only shows a "waiting to be
              redirected" message once the game has started. leaveRoom
              itself already works no matter the room's status — this was
              purely a missing UI affordance. */}
          <button
            onClick={handleLeaveRoom}
            disabled={isLoading}
            className="w-full mt-6 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 disabled:opacity-50 text-slate-900 dark:text-white font-semibold py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            Sair da Sala
          </button>
        </div>
      </div>
    </div>
  );
}
