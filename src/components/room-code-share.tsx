"use client";

import { useEffect, useState } from "react";

/**
 * Copy-to-clipboard and native share ("Compartilhar") controls for a
 * room's short code — sharing the raw code (or the room link) by reading
 * it aloud or retyping it was the whole point of switching away from the
 * old ObjectId-based URL; this makes sharing it a single tap instead.
 */
export function RoomCodeShare({ code }: { code: string }) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  // Feature-detect after mount: navigator.share isn't available during SSR
  // and isn't supported by every browser (most desktop browsers besides
  // Chrome/Edge lack it), so the button only renders where it'll work.
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const getRoomUrl = () =>
    typeof window !== "undefined" ? `${window.location.origin}/room/${code}` : `/room/${code}`;

  const handleCopy = async () => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar código:", err);
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2000);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: "Wordle Multiplayer",
        text: `Venha jogar Wordle comigo! Código da sala: ${code}`,
        url: getRoomUrl(),
      });
    } catch (err) {
      // AbortError just means the user dismissed the native share sheet —
      // not a real failure worth surfacing.
      if ((err as Error)?.name !== "AbortError") {
        console.error("Erro ao compartilhar:", err);
      }
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <button
        type="button"
        onClick={handleCopy}
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        {copied ? (
          <>✓ Copiado!</>
        ) : copyFailed ? (
          <>Falhou, tente selecionar manualmente</>
        ) : (
          <>📋 Copiar</>
        )}
      </button>
      {canShare && (
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          📤 Compartilhar
        </button>
      )}
    </div>
  );
}
