"use client";

import { useRouter } from "next/navigation";

/**
 * Botão interativo para entrar em uma sala existente.
 * Precisa ser Client Component: event handlers não podem ser
 * serializados a partir de Server Components.
 */
export function JoinRoomButton() {
  const router = useRouter();

  function handleClick() {
    const input = window.prompt("Digite o código da sala:");
    const code = input?.trim().toUpperCase();

    if (code) {
      router.push(`/room/${encodeURIComponent(code)}`);
    }
  }

  return (
    <button type="button" onClick={handleClick} className="btn-primary">
      Entrar em Sala
    </button>
  );
}
