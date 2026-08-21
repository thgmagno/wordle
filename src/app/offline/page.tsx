import Link from "next/link";

// Static fallback the service worker serves for a page navigation that
// fails outright with no connectivity at all (see public/sw.js) — nothing
// on this page depends on the network or the database, since the whole
// point is that neither is reachable right now.
export const metadata = {
  title: "Você está offline — Wordle",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-white dark:bg-slate-950">
      <div className="max-w-sm">
        <div className="text-6xl mb-6">📡</div>
        <h1 className="text-2xl font-bold mb-3 text-slate-900 dark:text-white">
          Você está offline
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Não foi possível conectar ao Wordle. Verifique sua conexão com a
          internet e tente novamente — o jogo precisa de uma conexão ativa
          para funcionar, já que as partidas acontecem em tempo real.
        </p>
        <Link href="/" className="btn-primary inline-flex">
          Tentar novamente
        </Link>
      </div>
    </div>
  );
}
