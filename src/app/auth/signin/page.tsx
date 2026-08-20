"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("google", { redirectTo: "/dashboard" });
    } catch (err) {
      setError("Erro ao fazer login com Google. Tente novamente.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Wordle
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-center mb-2">Bem-vindo</h1>
            <p className="text-center text-slate-600 dark:text-slate-400 mb-8">
              Faça login para começar a jogar Wordle com seus amigos
            </p>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 rounded-lg px-6 py-3 font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {isLoading ? "Conectando..." : "Entrar com Google"}
            </button>

            <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-8">
              Não tem conta?{" "}
              <span className="text-blue-600 dark:text-blue-400">
                Você será criado automaticamente ao fazer login
              </span>
            </p>
          </div>

          {/* Features */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">🎮</div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                Multiplayer
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Jogue com amigos em tempo real
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🏆</div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                Ranking
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Compete globalmente
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🇧🇷</div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                Português
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                100% em português brasileiro
              </p>
            </div>
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
