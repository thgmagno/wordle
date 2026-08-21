"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WordLengthSlider } from "@/components/word-length-slider";
import { startSinglePlayerGame } from "@/server/single-player-actions";

interface ActiveGame {
  id: string;
  wordLength: number;
}

export default function SinglePlayerStartClient({
  activeGame,
}: {
  activeGame: ActiveGame | null;
}) {
  const router = useRouter();
  const [wordLength, setWordLength] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A player can only have one single-player game going at a time (see
  // startSinglePlayerGame) — offer to resume it instead of a word-length
  // picker that would just resume the same game anyway.
  if (activeGame) {
    return (
      <div className="card text-center">
        <h3 className="text-lg font-semibold mb-2">
          Você tem uma partida em andamento
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Palavra de {activeGame.wordLength} letras
        </p>
        <button
          type="button"
          onClick={() => router.push(`/play/${activeGame.id}`)}
          className="btn-primary"
        >
          Continuar Partida
        </button>
      </div>
    );
  }

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await startSinglePlayerGame(wordLength);

      if (result.success && result.gameId) {
        router.push(`/play/${result.gameId}`);
      } else {
        setError(result.error || "Erro ao iniciar partida");
        setIsLoading(false);
      }
    } catch (err) {
      setError("Erro ao iniciar partida. Tente novamente.");
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Nova Partida</h3>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="mb-6">
        <p className="block text-sm font-semibold mb-3">Tamanho da Palavra</p>
        <WordLengthSlider
          value={wordLength}
          onChange={setWordLength}
          disabled={isLoading}
        />
      </div>

      <button
        type="button"
        onClick={handleStart}
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
      >
        {isLoading ? "Iniciando..." : "Jogar"}
      </button>
    </div>
  );
}
