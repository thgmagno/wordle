import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Wordle</h1>
          <nav className="flex gap-4">
            <Link href="/auth/signin" className="btn-secondary">
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className="max-w-2xl">
          <h2 className="text-5xl font-bold mb-6">Bem-vindo ao Wordle</h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
            Um jogo multiplayer de palavras em português. Adivinhe palavras com amigos, compete globalmente e suba no ranking!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">Multiplayer</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Crie salas e jogue com amigos em tempo real
              </p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-2">Ranking Global</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Compete com jogadores do mundo todo e chegue ao topo
              </p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-2">Palavras em Português</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Jogue com vocabulário autêntico do português brasileiro
              </p>
            </div>
          </div>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/auth/signin" className="btn-primary">
              Começar Agora
            </Link>
            <Link href="/rules" className="btn-secondary">
              Aprender Regras
            </Link>
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
