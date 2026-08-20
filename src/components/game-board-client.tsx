"use client";

import { useState, useEffect } from "react";
import { submitAttempt, advanceToNextRound } from "@/server/game-actions";
import { useGameRealtime } from "@/lib/use-realtime";
import { MAX_ATTEMPTS } from "@/lib/wordle-evaluation";
import { WordleGrid } from "./wordle-grid";
import { WordleKeyboard } from "./wordle-keyboard";

interface MatchResultEntry {
  userId: string;
  user: { id: string; name: string | null; image: string | null };
  finalScore: number;
  placement: number;
}

interface GameState {
  id: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  isSpectator: boolean;
  rounds: any[];
  room: { wordLength: number };
  matchResults?: MatchResultEntry[];
}

interface AttemptResult {
  letter: string;
  status: "CORRECT" | "PRESENT" | "ABSENT";
}

/**
 * Final placar: every player who took part in the match, ranked by total
 * score, once the match itself has ended (CLAUDE.md section 22 — colocação,
 * nome, foto e pontuação por jogador).
 */
function FinalScoreboard({ results }: { results: MatchResultEntry[] }) {
  return (
    <div className="space-y-2 text-left">
      <h3 className="text-lg font-semibold text-center mb-3">🏆 Placar Final</h3>
      {results.map((entry) => (
        <div
          key={entry.userId}
          className={`flex items-center gap-3 p-3 rounded-lg border ${
            entry.placement === 1
              ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700"
              : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600"
          }`}
        >
          <span className="w-8 shrink-0 text-center font-bold text-slate-500 dark:text-slate-400">
            {entry.placement}º
          </span>
          {entry.user.image ? (
            <img src={entry.user.image} alt="" className="w-8 h-8 rounded-full shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
          )}
          <span className="flex-1 min-w-0 truncate font-medium">
            {entry.user.name || "Jogador"}
          </span>
          <span className="shrink-0 font-bold">{entry.finalScore} pts</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Round advancement controls, shared by the spectator and active-player
 * Game Over screens below.
 *
 * This only ever renders for a round that finished but the match hasn't
 * (gameState.status === "FINISHED" is handled by GameBoardClient's own
 * early return, before either screen below gets a chance to render this).
 * Advancing happens automatically the instant a round finishes for
 * everyone (see submitAttempt/advanceGameInternal) — this button is a
 * manual fallback for the rare case that doesn't fire, which is why a
 * non-host only ever sees a waiting message, never a disabled button.
 */
function RoundAdvanceControls({
  gameState,
  isHost,
  isLoading,
  onAdvance,
}: {
  gameState: GameState;
  isHost: boolean;
  isLoading: boolean;
  onAdvance: () => void;
}) {
  const isLastRound = gameState.currentRound >= gameState.totalRounds;

  if (!isHost) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {isLastRound
          ? "Aguardando o anfitrião finalizar a partida..."
          : "Aguardando o anfitrião iniciar a próxima rodada..."}
      </p>
    );
  }

  return (
    <button
      onClick={onAdvance}
      disabled={isLoading}
      className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
    >
      {isLoading ? "Carregando..." : isLastRound ? "Finalizar Partida" : "Próxima Rodada"}
    </button>
  );
}

export default function GameBoardClient({
  gameId,
  gameState,
  currentUserId,
  isHost,
}: {
  gameId: string;
  gameState: GameState;
  currentUserId: string;
  isHost: boolean;
}) {
  useGameRealtime(gameId);

  const [word, setWord] = useState("");
  const [attempts, setAttempts] = useState(gameState.rounds[0]?.attempts || []);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [keyboardState, setKeyboardState] = useState<Map<string, string>>(new Map());

  const currentRound = gameState.rounds[0];
  const maxAttempts = MAX_ATTEMPTS;
  const wordLength = gameState.room.wordLength;

  // Realtime updates re-render this component with a fresh `gameState` prop
  // instead of remounting it, so local per-round state needs to be reset
  // explicitly whenever the round actually changes (e.g. the host advanced
  // to the next round on another client).
  useEffect(() => {
    setAttempts(gameState.rounds[0]?.attempts || []);
    setIsGameOver(false);
    setIsWon(false);
    setWord("");
    setError(null);
    setSuccess(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.rounds[0]?.id]);

  // Check if game is over or won
  useEffect(() => {
    if (attempts.length > 0) {
      const lastAttempt = attempts[attempts.length - 1];
      if (lastAttempt.isCorrect) {
        setIsWon(true);
        setIsGameOver(true);
      } else if (attempts.length >= maxAttempts) {
        setIsGameOver(true);
      }
    }
  }, [attempts]);

  // Update keyboard state
  useEffect(() => {
    const newKeyboardState = new Map<string, string>();
    const statusRank: Record<string, number> = { CORRECT: 3, PRESENT: 2, ABSENT: 1 };

    attempts.forEach((attempt: any) => {
      attempt.result.forEach((r: AttemptResult) => {
        const currentStatus = newKeyboardState.get(r.letter) || "ABSENT";
        const currentRank = statusRank[currentStatus];
        const newRank = statusRank[r.status];
        if (newRank > currentRank) {
          newKeyboardState.set(r.letter, r.status);
        }
      });
    });

    setKeyboardState(newKeyboardState);
  }, [attempts]);

  const handleSubmitAttempt = async () => {
    if (word.length !== wordLength) {
      setError(`A palavra deve ter exatamente ${wordLength} letras`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await submitAttempt(currentRound.id, word);

      if (result.success && result.feedback) {
        const newAttempt = {
          attemptText: word,
          result: result.feedback,
          isCorrect: result.isCorrect,
        };

        setAttempts([...attempts, newAttempt]);
        setWord("");

        if (result.isCorrect) {
          setSuccess("Parabéns! Você acertou!");
          setIsWon(true);
          setIsGameOver(true);
        } else if (attempts.length + 1 >= maxAttempts) {
          setIsGameOver(true);
          // The answer isn't revealed to this player until the round is
          // actually FINISHED for everyone (see getGameState) — the Game
          // Over screen below shows it once that happens, so this message
          // only needs to say the attempts ran out, not guess at the word.
          setError("Fim das tentativas!");
        }
      } else {
        setError(result.error || "Erro ao enviar tentativa");
      }
    } catch (err) {
      setError("Erro ao enviar tentativa");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextRound = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Only host can advance. On the last round this same call is what
      // finalizes the match (advanceToNextRound flips Game/Room status to
      // FINISHED and records final statistics) — there is no separate
      // "finish game" action.
      const result = await advanceToNextRound(gameId);

      if (result.success) {
        // Reload page or navigate to next round
        window.location.reload();
      } else {
        setError(result.error || "Erro ao avançar a partida");
      }
    } catch (err) {
      setError("Erro ao avançar a partida");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (key: string) => {
    if (isGameOver || isLoading) return;

    if (key === "enter") {
      handleSubmitAttempt();
    } else if (key === "backspace") {
      setWord(word.slice(0, -1));
    } else if (word.length < wordLength) {
      setWord(word + key);
    }
  };

  // Once the match itself has ended, none of the round UI (grid, keyboard,
  // input, per-round result) is relevant anymore. With several rounds
  // played this used to leave the final placar sitting below a full page
  // of stale board/keyboard content the player had to scroll past — this
  // replaces the whole screen with just the result instead.
  if (gameState.status === "FINISHED") {
    return (
      <div className="card bg-slate-50 dark:bg-slate-800 text-center space-y-6">
        <h2 className="text-2xl font-bold">🏁 Partida Encerrada</h2>
        {gameState.matchResults && gameState.matchResults.length > 0 && (
          <FinalScoreboard results={gameState.matchResults} />
        )}
        <a href="/dashboard" className="btn-primary inline-flex">
          Voltar para Dashboard
        </a>
      </div>
    );
  }

  if (gameState.isSpectator) {
    const othersProgress: Array<{
      user: { id: string; name: string | null; image: string | null };
      attempts: Array<{ attemptText: string; result: AttemptResult[] }>;
    }> = currentRound?.othersProgress ?? [];

    return (
      <div className="space-y-6">
        <div className="card text-center">
          <h2 className="text-2xl font-bold mb-4">👁️ Modo Espectador</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Você está em modo espectador nesta rodada. Sua palavra foi selecionada para ser a resposta!
          </p>
          {currentRound && (
            <div className="bg-slate-100 dark:bg-slate-700 p-4 rounded-lg mb-6">
              <p className="text-sm text-slate-600 dark:text-slate-400">Sua palavra:</p>
              <p className="text-2xl font-bold">{currentRound.answerWord || "***"}</p>
            </div>
          )}
          <p className="text-slate-600 dark:text-slate-400">
            Acompanhe as tentativas dos outros jogadores abaixo.
          </p>
        </div>

        <div className="space-y-6">
          {othersProgress.length === 0 && (
            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
              Ninguém tentou ainda nesta rodada.
            </p>
          )}

          {othersProgress.map((player) => (
            <div key={player.user.id} className="card">
              <div className="flex items-center gap-2 mb-4">
                {player.user.image && (
                  <img src={player.user.image} alt="" className="w-6 h-6 rounded-full" />
                )}
                <span className="font-semibold">{player.user.name || "Jogador"}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {player.attempts.length}/{maxAttempts} tentativas
                </span>
              </div>
              <div className="flex justify-center">
                <WordleGrid attempts={player.attempts} wordLength={wordLength} maxAttempts={maxAttempts} />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Round advancement controls. The spectator (the round's word
            owner) never plays this round themselves, but if they're also
            the host, they're the only one who can advance the game once
            everyone else has finished — without this, a host whose word
            got drawn would leave every other player stuck forever waiting
            on a "Próxima Rodada" button that only ever rendered in the
            non-spectator branch below. */}
        {currentRound?.status === "FINISHED" && (
          <div className="card bg-slate-50 dark:bg-slate-800 text-center">
            <RoundAdvanceControls
              gameState={gameState}
              isHost={isHost}
              isLoading={isLoading}
              onAdvance={handleNextRound}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Wordle Grid */}
      <div className="flex justify-center">
        <WordleGrid
          attempts={attempts}
          wordLength={wordLength}
          currentAttempt={word}
          maxAttempts={maxAttempts}
        />
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-center">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg text-center">
          {success}
        </div>
      )}

      {/* Attempt counter — the current attempt itself is shown as tiles in
          the grid above (WordleGrid's currentAttempt prop), not in a text
          field, so there's nothing focusable here to trigger a mobile
          on-screen keyboard. */}
      {!isGameOver && (
        <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
          Tentativas: {attempts.length}/{maxAttempts}
        </p>
      )}

      {/* Submit button, positioned above the keyboard rather than inline
          with a text input: typing happens exclusively through
          WordleKeyboard below (its on-screen buttons or a physical
          keyboard) — there is intentionally no focusable text input on this
          screen, so the native mobile keyboard never has anything to pop
          up for. */}
      {!isGameOver && (
        <button
          onClick={handleSubmitAttempt}
          disabled={isLoading || word.length !== wordLength}
          className="w-full max-w-2xl mx-auto block bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {isLoading ? "Enviando..." : "Enviar"}
        </button>
      )}

      {/* Keyboard */}
      <WordleKeyboard
        attempts={attempts}
        onKeyPress={handleKeyPress}
        disabled={isGameOver || isLoading}
        wordLength={wordLength}
      />

      {/* Game Over Screen */}
      {isGameOver && (
        <div className="card bg-slate-50 dark:bg-slate-800 text-center">
          {isWon ? (
            <>
              <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-4">
                🎉 Parabéns!
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Você acertou em {attempts.length} {attempts.length === 1 ? "tentativa" : "tentativas"}!
              </p>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">
                Game Over
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {currentRound?.answerWord ? (
                  <>
                    A palavra era: <span className="font-bold text-lg">{currentRound.answerWord}</span>
                  </>
                ) : (
                  "Aguardando o fim da rodada para revelar a palavra..."
                )}
              </p>
            </>
          )}

          {currentRound?.status !== "FINISHED" ? (
            // Other players may still be on their own attempts — the round
            // (and any "next round"/"finish" action) only becomes available
            // once every active player has solved it or run out of guesses.
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Aguardando os outros jogadores concluírem a rodada...
            </p>
          ) : (
            <RoundAdvanceControls
              gameState={gameState}
              isHost={isHost}
              isLoading={isLoading}
              onAdvance={handleNextRound}
            />
          )}
        </div>
      )}
    </div>
  );
}
