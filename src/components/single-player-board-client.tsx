"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_ATTEMPTS } from "@/lib/wordle-evaluation";
import {
  startSinglePlayerGame,
  submitSinglePlayerAttempt,
} from "@/server/single-player-actions";
import { Toast } from "./toast";
import { WordleGrid } from "./wordle-grid";
import { WordleKeyboard } from "./wordle-keyboard";

interface AttemptResult {
  letter: string;
  status: "CORRECT" | "PRESENT" | "ABSENT";
}

interface SinglePlayerGameState {
  id: string;
  wordLength: number;
  status: "ACTIVE" | "WON" | "LOST";
  attempts: Array<{
    attemptText: string;
    result: AttemptResult[];
    isCorrect: boolean;
  }>;
  answerWord?: string;
}

/**
 * Single-player game board. Deliberately much simpler than the
 * multiplayer GameBoardClient: no spectator mode, no other players to
 * wait on, no realtime subscription — a solo game only ever has one
 * participant, in one tab, so there's nothing for another client to push
 * an update about.
 */
export default function SinglePlayerBoardClient({
  gameState,
}: {
  gameState: SinglePlayerGameState;
}) {
  const router = useRouter();

  const [word, setWord] = useState("");
  const [attempts, setAttempts] = useState(gameState.attempts);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [status, setStatus] = useState(gameState.status);
  const [answerWord, setAnswerWord] = useState(gameState.answerWord);

  const wordLength = gameState.wordLength;
  const maxAttempts = MAX_ATTEMPTS;
  const isGameOver = status !== "ACTIVE";
  const isWon = status === "WON";

  const handleSubmitAttempt = async () => {
    if (word.length !== wordLength) {
      setError(`A palavra deve ter exatamente ${wordLength} letras`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await submitSinglePlayerAttempt(gameState.id, word);

      if (result.success && result.feedback) {
        const newAttempt = {
          attemptText: word,
          result: result.feedback,
          isCorrect: result.isCorrect ?? false,
        };
        setAttempts((prev) => [...prev, newAttempt]);
        setWord("");

        if (result.gameOver) {
          setStatus(result.won ? "WON" : "LOST");
          setAnswerWord(result.answerWord);
          if (result.won) {
            setSuccess("Parabéns! Você acertou!");
          }
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

  const handleKeyPress = (key: string) => {
    if (isGameOver || isLoading) return;

    if (key === "enter") {
      handleSubmitAttempt();
    } else if (key === "backspace") {
      setWord((w) => w.slice(0, -1));
    } else if (word.length < wordLength) {
      setWord((w) => w + key);
    }
  };

  const handlePlayAgain = async () => {
    setIsRestarting(true);
    setError(null);

    try {
      const result = await startSinglePlayerGame(wordLength);
      if (result.success && result.gameId) {
        router.push(`/play/${result.gameId}`);
      } else {
        setError(result.error || "Erro ao iniciar nova partida");
        setIsRestarting(false);
      }
    } catch (err) {
      setError("Erro ao iniciar nova partida");
      console.error(err);
      setIsRestarting(false);
    }
  };

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* Wordle Grid */}
      <div className="flex justify-center">
        <WordleGrid
          attempts={attempts}
          wordLength={wordLength}
          currentAttempt={word}
          maxAttempts={maxAttempts}
        />
      </div>

      {/* Messages float above the page as a toast instead of an inline
          banner — an inline banner pushes the grid/keyboard down and was
          exactly what forced the board below the fold on a phone screen. */}
      {error && (
        <Toast message={error} type="error" onDismiss={() => setError(null)} />
      )}
      {success && (
        <Toast
          message={success}
          type="success"
          onDismiss={() => setSuccess(null)}
        />
      )}

      {/* Attempt counter — the current attempt is shown as tiles in the
          grid above, not in a text field, so there's nothing focusable
          here to trigger a mobile on-screen keyboard. */}
      {!isGameOver && (
        <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
          Tentativas: {attempts.length}/{maxAttempts}
        </p>
      )}

      {/* Submit button, positioned above the keyboard — typing happens
          exclusively through WordleKeyboard below. */}
      {!isGameOver && (
        <button
          type="button"
          onClick={handleSubmitAttempt}
          disabled={isLoading || word.length !== wordLength}
          className="w-full max-w-2xl mx-auto block bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-2 sm:py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
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
        <div className="card bg-slate-50 dark:bg-slate-800 text-center space-y-3 sm:space-y-6 py-4 sm:py-6">
          {isWon ? (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 mb-1 sm:mb-2">
                🎉 Parabéns!
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                Você acertou em {attempts.length}{" "}
                {attempts.length === 1 ? "tentativa" : "tentativas"}!
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400 mb-1 sm:mb-2">
                Game Over
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                A palavra era:{" "}
                <span className="font-bold text-lg">{answerWord}</span>
              </p>
            </>
          )}

          <div className="flex gap-3 justify-center flex-wrap">
            <button
              type="button"
              onClick={handlePlayAgain}
              disabled={isRestarting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold px-6 py-2 sm:py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isRestarting ? "Carregando..." : "Jogar Novamente"}
            </button>
            <a href="/dashboard" className="btn-secondary">
              Voltar para Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
