"use client";

import { useEffect, useState } from "react";
import { getPlayerProfile } from "@/server/ranking-actions";

interface RankingEntry {
  rank: number;
  user: { id: string; name: string | null; image: string | null };
  statistics: {
    totalGamesPlayed: number;
    totalWins: number;
    totalPoints: number;
    averageScore: number;
  };
}

interface PlayerProfile {
  user: { id: string; name: string | null; image: string | null };
  statistics: {
    totalGamesPlayed: number;
    averageScore: number;
  } | null;
}

/**
 * Renders the ranking table and, per CLAUDE.md section 11, opens a modal
 * with a player's photo/name/games played/average score when their name
 * is clicked. Fetches lazily via the getPlayerProfile Server Action
 * instead of shipping every player's full profile to the client up front.
 */
export function LeaderboardTable({ items }: { items: RankingEntry[] }) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const closeProfile = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const openProfile = async (userId: string) => {
    setIsOpen(true);
    setIsLoading(true);
    setError(null);
    setProfile(null);

    try {
      const result = await getPlayerProfile(userId);
      if (result) {
        setProfile(result);
      } else {
        setError("Não foi possível carregar o perfil deste jogador.");
      }
    } catch (err) {
      setError("Não foi possível carregar o perfil deste jogador.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3 text-left">Posição</th>
              <th className="px-4 py-3 text-left">Jogador</th>
              <th className="px-4 py-3 text-right">Partidas</th>
              <th className="px-4 py-3 text-right">Vitórias</th>
              <th className="px-4 py-3 text-right">Pontuação</th>
              <th className="px-4 py-3 text-right">Média</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((entry) => (
                <tr
                  key={entry.user.id}
                  className={`border-b border-slate-200 dark:border-slate-700 ${
                    entry.rank <= 3 ? "bg-yellow-50 dark:bg-yellow-900/10" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-bold text-lg">
                      {entry.rank === 1 && "🥇"}
                      {entry.rank === 2 && "🥈"}
                      {entry.rank === 3 && "🥉"}
                      {entry.rank > 3 && `#${entry.rank}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openProfile(entry.user.id)}
                      className="flex items-center gap-3 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 rounded"
                      aria-label={`Ver perfil de ${entry.user.name || "jogador"}`}
                    >
                      {entry.user.image && (
                        <img
                          src={entry.user.image}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <span className="font-semibold">{entry.user.name || "Usuário Anônimo"}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">{entry.statistics.totalGamesPlayed}</td>
                  <td className="px-4 py-3 text-right">{entry.statistics.totalWins}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                    {entry.statistics.totalPoints}
                  </td>
                  <td className="px-4 py-3 text-right">{entry.statistics.averageScore.toFixed(1)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-600 dark:text-slate-400">
                  Nenhum jogador no ranking ainda. Comece a jogar!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            tabIndex={-1}
            onClick={closeProfile}
            className="absolute inset-0 bg-black/50 cursor-default"
          />

          <div
            className="card w-full max-w-sm relative z-10"
            role="dialog"
            aria-modal="true"
            aria-label="Perfil do jogador"
          >
            <button
              type="button"
              onClick={closeProfile}
              aria-label="Fechar"
              className="absolute top-3 right-3 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xl leading-none"
            >
              ×
            </button>

            {isLoading && (
              <p className="text-center py-8 text-slate-600 dark:text-slate-400">Carregando...</p>
            )}

            {!isLoading && error && (
              <p className="text-center py-8 text-red-600 dark:text-red-400">{error}</p>
            )}

            {!isLoading && !error && profile && (
              <div className="text-center pt-2">
                {profile.user.image ? (
                  <img
                    src={profile.user.image}
                    alt=""
                    className="w-20 h-20 rounded-full mx-auto mb-4"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-slate-200 dark:bg-slate-700" />
                )}
                <h3 className="text-xl font-bold mb-4">{profile.user.name || "Usuário Anônimo"}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {profile.statistics?.totalGamesPlayed ?? 0}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Partidas Jogadas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {(profile.statistics?.averageScore ?? 0).toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Pontuação Média</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
