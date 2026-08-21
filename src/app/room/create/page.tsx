"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom } from "@/server/room-actions";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default function CreateRoomPage() {
  const router = useRouter();
  const [wordLength, setWordLength] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only for the "already in another room" rejection — offers a
  // direct link back to it instead of just an error with no way out. A
  // click from the dashboard's own "Criar Sala" card shouldn't normally
  // reach this (it links to /room/[code] instead in that state), but this
  // page is also reachable by a direct URL, which has no way to know that
  // ahead of time.
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setIsLoading(true);
    setError(null);
    setActiveRoomCode(null);

    try {
      // Get current user ID from session
      const response = await fetch("/api/session");
      const session = await response.json();

      if (!session?.user?.id) {
        setError("Você precisa estar autenticado");
        return;
      }

      const result = await createRoom(wordLength);

      if (result.success && result.roomId) {
        router.push(`/room/${result.roomId}`);
      } else {
        setError(result.error || "Erro ao criar sala");
        setActiveRoomCode(result.activeRoomCode ?? null);
      }
    } catch (err) {
      setError("Erro ao criar sala. Tente novamente.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
            Wordle
          </Link>
          <span className="text-slate-600 dark:text-slate-400">/ Criar Sala</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-center mb-2">Criar Nova Sala</h1>
            <p className="text-center text-slate-600 dark:text-slate-400 mb-8">
              Escolha o tamanho das palavras para sua partida
            </p>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
                {error}
                {activeRoomCode && (
                  <Link
                    href={`/room/${activeRoomCode}`}
                    className="block mt-2 font-semibold underline"
                  >
                    Voltar para Minha Sala
                  </Link>
                )}
              </div>
            )}

            {/* Word Length Selection */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Tamanho da Palavra
              </label>
              <div className="grid grid-cols-3 gap-4">
                {[4, 5, 6].map((length) => (
                  <button
                    key={length}
                    onClick={() => setWordLength(length)}
                    className={`py-4 rounded-lg font-bold text-lg transition-all ${
                      wordLength === length
                        ? "bg-blue-600 text-white shadow-lg"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    {length}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                Escolha quantas letras terão as palavras nesta sala
              </p>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreateRoom}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isLoading ? "Criando sala..." : "Criar Sala"}
            </button>

            {/* Back Button */}
            <Link
              href="/dashboard"
              className="block w-full text-center mt-4 text-blue-600 dark:text-blue-400 hover:underline"
            >
              Voltar para Painel
            </Link>
          </div>

          {/* Info Cards */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { length: 4, label: "Fácil" },
              { length: 5, label: "Normal" },
              { length: 6, label: "Difícil" },
            ].map(({ length, label }) => (
              <div key={length} className="bg-white dark:bg-slate-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">{length}</div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>© 2026 Wordle. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
