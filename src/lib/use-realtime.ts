"use client";

import { useEffect, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

function isRealtimeEnabled(): boolean {
  // Explicitly documented opt-out for environments that don't run the
  // custom server.js (see README). Enabled by default otherwise.
  return process.env.NEXT_PUBLIC_SOCKET_IO_ENABLED !== "false";
}

function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: process.env.NEXT_PUBLIC_SOCKET_IO_PATH || "/socket.io",
    });
  }
  return socket;
}

/**
 * Subscribes to realtime updates for a room's lobby. Any "room:update"
 * event (emitted by the server after a join/leave/word submission/game
 * start) triggers a Server Component refresh, so the lobby reflects the
 * new state without the user having to reload the page.
 *
 * `suppressRefreshRef`, when passed, lets the caller silence the next
 * refresh(es) — needed because a player's own `leaveRoom()` call broadcasts
 * "room:update" to everyone still subscribed to the room's channel,
 * including this same client (its socket doesn't unsubscribe until the
 * component unmounts, which hasn't happened yet while the action is still
 * in flight). Without suppressing it, that self-triggered refresh would
 * re-render RoomPage as a genuine navigation — with this player now absent
 * from the participant list — and its auto-join-on-visit logic (CLAUDE.md
 * section 14) would silently add them right back before the router
 * finishes navigating them away.
 */
export function useRoomRealtime(
  roomId: string,
  suppressRefreshRef?: RefObject<boolean>
): void {
  const router = useRouter();

  useEffect(() => {
    if (!isRealtimeEnabled() || !roomId) {
      return;
    }

    const s = getSocket();
    s.emit("room:join", roomId);

    const handleUpdate = () => {
      if (suppressRefreshRef?.current) {
        return;
      }
      router.refresh();
    };
    s.on("room:update", handleUpdate);

    return () => {
      s.off("room:update", handleUpdate);
      s.emit("room:leave", roomId);
    };
  }, [roomId, router, suppressRefreshRef]);
}

/**
 * Subscribes to realtime updates for a game (players and the round's
 * spectator). Any "game:update" event (new attempt, round finished, next
 * round started, match ended) triggers a Server Component refresh.
 */
export function useGameRealtime(gameId: string): void {
  const router = useRouter();

  useEffect(() => {
    if (!isRealtimeEnabled() || !gameId) {
      return;
    }

    const s = getSocket();
    s.emit("game:join", gameId);

    const handleUpdate = () => router.refresh();
    s.on("game:update", handleUpdate);

    return () => {
      s.off("game:update", handleUpdate);
      s.emit("game:leave", gameId);
    };
  }, [gameId, router]);
}
