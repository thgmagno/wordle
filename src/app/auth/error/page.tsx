"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = (errorCode: string | null): string => {
    switch (errorCode) {
      case "Callback":
        return "Erro ao processar o login. Tente novamente.";
      case "OAuthSignin":
        return "Erro ao conectar com Google. Tente novamente.";
      case "OAuthCallback":
        return "Erro ao fazer callback do Google. Tente novamente.";
      case "EmailSigninEmail":
        return "E-mail inválido. Verifique e tente novamente.";
      case "Default":
        return "Erro na autenticação. Tente novamente.";
      default:
        return "Ocorreu um erro durante a autenticação. Tente novamente.";
    }
  };

  return <ErrorPageContent errorMessage={getErrorMessage(error)} />;
}

function ErrorPageContent({ errorMessage }: { errorMessage: string }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Wordle
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-3xl font-bold text-red-600 mb-2">
              Erro na Autenticação
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              {errorMessage}
            </p>

            <div className="space-y-3">
              <Link
                href="/auth/signin"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Tentar Novamente
              </Link>
              <Link
                href="/"
                className="block w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Voltar para Home
              </Link>
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

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<ErrorPageContent errorMessage="Carregando..." />}>
      <AuthErrorContent />
    </Suspense>
  );
}
