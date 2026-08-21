"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leaveRoom } from "@/server/room-actions";

/**
 * Leave a room from anywhere the player might be looking at it — the
 * dashboard's "Sala Atual" card, the room lobby, or the game screen
 * itself — not just the lobby's own pre-game form.
 *
 * This exists because `leaveRoom` (room-actions.ts) already works no
 * matter what state the room or its match is in — it just flips this
 * user's own RoomParticipant to LEFT, which is all `findActiveRoomParticipation`
 * checks — but for a while the only button that called it lived inside
 * RoomLobbyClient's LOBBY-only branch. Once a match started, a player
 * got auto-redirected into /game/[gameId] and had no way back out: if
 * that match then stalled (a player disconnected mid-round and the
 * round's "everyone's done" check — see submitAttempt — never fires,
 * so nothing ever advances the game or room to FINISHED), the room
 * stayed "active" forever with no UI path to leave it. The only
 * workaround anyone had was logging out and coming back as a different
 * guest, which doesn't fix anything — it just abandons the stuck
 * account instead of freeing it. This button is the actual fix: it's
 * always rendered wherever a player might be stuck, regardless of the
 * room's or match's status.
 */
export function LeaveRoomButton({
  roomCode,
  label = "Sair da Sala",
  loadingLabel = "Saindo...",
  confirmMessage = "Deseja sair da sala?",
  className = "btn-secondary",
}: {
  roomCode: string;
  label?: string;
  loadingLabel?: string;
  confirmMessage?: string;
  className?: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLeave = async () => {
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsLoading(true);
    try {
      await leaveRoom(roomCode);
      router.push("/dashboard");
      router.refresh();
    } catch {
      // leaveRoom itself never throws (it returns { success: false, ... }
      // on failure) — this only catches something unexpected like a
      // network error. Either way, staying put with the button re-enabled
      // beats a silently stuck loading state.
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLeave}
      disabled={isLoading}
      className={`${className} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isLoading ? loadingLabel : label}
    </button>
  );
}
