import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RulesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Wordle
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/auth/signin" className="btn-secondary">
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-4 text-center">Como Jogar</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-12 text-center">
            Adivinhe a palavra secreta usando as dicas de cores em cada tentativa.
          </p>

          {/* Objetivo */}
          <section className="card mb-6">
            <h2 className="text-xl font-semibold mb-3">Objetivo</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Descubra a palavra secreta em até 6 tentativas. Cada palpite precisa ser uma
              palavra válida do dicionário em português, com o número exato de letras da
              partida.
            </p>
          </section>

          {/* Feedback de cores */}
          <section className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">O que as cores significam</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="wordle-tile correct w-12 h-12 shrink-0">A</div>
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white">Verde</span> —
                  a letra está correta e na posição certa.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="wordle-tile present w-12 h-12 shrink-0">B</div>
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white">Amarelo</span> —
                  a letra existe na palavra, mas em outra posição.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="wordle-tile absent w-12 h-12 shrink-0">C</div>
                <p className="text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-900 dark:text-white">Cinza</span> —
                  a letra não está na palavra.
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
              Quando uma letra aparece mais de uma vez no seu palpite, apenas as ocorrências
              que realmente existem na palavra secreta são marcadas como verde ou amarelo — o
              resto fica cinza.
            </p>
          </section>

          {/* Tamanho e tentativas */}
          <section className="card mb-6">
            <h2 className="text-xl font-semibold mb-3">Palavras e tentativas</h2>
            <ul className="space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                Cada sala é criada com palavras de{" "}
                <span className="font-semibold text-slate-900 dark:text-white">4, 5 ou 6 letras</span>
                .
              </li>
              <li>
                Você tem{" "}
                <span className="font-semibold text-slate-900 dark:text-white">6 tentativas</span>{" "}
                para acertar em cada rodada.
              </li>
              <li>Cada palpite precisa existir no dicionário — não é possível enviar qualquer sequência de letras.</li>
            </ul>
          </section>

          {/* Multiplayer */}
          <section className="card mb-6">
            <h2 className="text-xl font-semibold mb-3">Modo multiplayer</h2>
            <ul className="space-y-2 text-slate-600 dark:text-slate-400 list-disc list-inside">
              <li>Ao entrar em uma sala, cada jogador envia sua própria palavra secreta.</li>
              <li>A partida tem uma rodada para cada jogador — a palavra de cada um é usada como resposta em uma rodada diferente.</li>
              <li>
                Na rodada em que sua palavra é a resposta, você entra em{" "}
                <span className="font-semibold text-slate-900 dark:text-white">modo espectador</span>
                : não tenta adivinhar, mas acompanha em tempo real as tentativas dos outros jogadores.
              </li>
              <li>Nos demais casos, você joga normalmente tentando descobrir a palavra da rodada.</li>
            </ul>
          </section>

          {/* Pontuação */}
          <section className="card mb-12">
            <h2 className="text-xl font-semibold mb-3">Pontuação</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Quanto menos tentativas você usar para acertar, mais pontos ganha na rodada. Ao
              final da partida, os pontos de todas as rodadas são somados e definem a colocação
              de cada jogador no placar final.
            </p>
          </section>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/auth/signin" className="btn-primary">
              Começar Agora
            </Link>
            <Link href="/" className="btn-secondary">
              Voltar
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
