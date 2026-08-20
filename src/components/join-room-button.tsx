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
    const roomId = window.prompt("Digite o ID da sala:");
    const trimmed = roomId?.trim();

    if (trimmed) {
      router.push(`/room/${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <button type="button" onClick={handleClick} className="btn-primary">
      Entrar em Sala
    </button>
  );
}
