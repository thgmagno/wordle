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
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center text-center">
        <div className="max-w-2xl">
          <h2 className="text-5xl font-bold mb-6">Welcome to Wordle</h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-8">
            A multiplayer word game in Portuguese. Guess words with friends, compete globally, and climb
            the leaderboard!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="card">
              <h3 className="text-lg font-semibold mb-2">Multiplayer</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Create rooms and play with friends in real-time
              </p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-2">Global Ranking</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Compete with players worldwide and reach the top
              </p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-2">Portuguese Words</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Play with authentic Brazilian Portuguese vocabulary
              </p>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <Link href="/auth/signin" className="btn-primary">
              Get Started
            </Link>
            <Link href="/rules" className="btn-secondary">
              Learn Rules
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>© 2026 Wordle. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
