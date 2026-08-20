"use client";

import { useState, useEffect } from "react";
import { updateLeaderboardVisibility } from "@/server/ranking-actions";
import { signOut } from "next-auth/react";

export default function ProfileClient({ userId }: { userId: string }) {
  const [showInLeaderboard, setShowInLeaderboard] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Fetch user preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const response = await fetch(`/api/user/preferences/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setShowInLeaderboard(data.showInLeaderboard !== false);
        }
      } catch (err) {
        console.error("Erro ao carregar preferências:", err);
      }
    };

    fetchPreferences();
  }, [userId]);

  const handleToggleLeaderboard = async () => {
    setIsLoading(true);
    setIsSaved(false);

    try {
      const result = await updateLeaderboardVisibility(!showInLeaderboard);

      if (result.success) {
        setShowInLeaderboard(!showInLeaderboard);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      }
    } catch (err) {
      console.error("Erro ao atualizar preferência:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("Deseja sair da sua conta?")) {
      await signOut({ callbackUrl: "/" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Leaderboard Visibility */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold mb-1">Mostrar no Ranking</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {showInLeaderboard
                ? "Seu perfil está visível no ranking global"
                : "Seu perfil está oculto no ranking"}
            </p>
          </div>
          <button
            onClick={handleToggleLeaderboard}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              showInLeaderboard
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
            } disabled:opacity-50`}
          >
            {showInLeaderboard ? "Visível" : "Oculto"}
          </button>
        </div>

        {isSaved && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            ✓ Preferência salva
          </p>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 py-2 rounded-lg font-semibold transition-colors"
      >
        Sair da Conta
      </button>
    </div>
  );
}
