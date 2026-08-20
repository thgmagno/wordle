"use client";

import { useState, useEffect } from "react";
import { submitAttempt, advanceToNextRound } from "@/server/game-actions";
import { useGameRealtime } from "@/lib/use-realtime";
import { WordleGrid } from "./wordle-grid";
import { WordleKeyboard } from "./wordle-keyboard";

interface GameState {
  id: string;
  status: string;
  currentRound: number;
  totalRounds: number;
  isSpectator: boolean;
  rounds: any[];
}

interface AttemptResult {
  letter: string;
  status: "CORRECT" | "PRESENT" | "ABSENT";
}

export default function GameBoardClient({
  gameId,
  gameState,
  currentUserId,
}: {
  gameId: string;
  gameState: GameState;
  currentUserId: string;
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
  const maxAttempts = 6;
  const wordLength = 5; // Should come from room, but using default for now

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
          setError(`Fim do jogo! A palavra era: ${currentRound.answerWord}`);
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
      // Only host can advance
      const result = await advanceToNextRound(gameId);

      if (result.success) {
        // Reload page or navigate to next round
        window.location.reload();
      } else {
        setError(result.error || "Erro ao avançar para próxima rodada");
      }
    } catch (err) {
      setError("Erro ao avançar para próxima rodada");
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

  if (gameState.isSpectator) {
    return (
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

      {/* Input */}
      {!isGameOver && (
        <div className="card">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value.toLowerCase().slice(0, wordLength))}
              maxLength={wordLength}
              placeholder="Digite sua tentativa..."
              className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase text-center text-2xl font-bold tracking-widest"
              disabled={isLoading}
              autoFocus
            />
            <button
              onClick={handleSubmitAttempt}
              disabled={isLoading || word.length !== wordLength}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isLoading ? "..." : "Enviar"}
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
            Tentativas: {attempts.length}/{maxAttempts}
          </p>
        </div>
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
                A palavra era: <span className="font-bold text-lg">{currentRound?.answerWord}</span>
              </p>
            </>
          )}

          {gameState.currentRound < gameState.totalRounds && (
            <button
              onClick={handleNextRound}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isLoading ? "Carregando..." : "Próxima Rodada"}
            </button>
          )}

          {gameState.currentRound === gameState.totalRounds && (
            <a href="/dashboard" className="btn-primary">
              Voltar para Dashboard
            </a>
          )}
        </div>
      )}
    </div>
  );
}
