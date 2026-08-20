"use client";

import { useRouter } from "next/navigation";
import PusherClient from "pusher-js";
import { type RefObject, useEffect } from "react";

let pusherClient: PusherClient | null | undefined;

/**
 * Lazily creates the shared Pusher client. Returns `null` (and does so
 * every time after) when the public key/cluster aren't configured — that's
 * the intentional "realtime disabled" fallback described in
 * src/lib/realtime.ts, not an error: the app is fully usable without it,
 * just without live updates.
 */
function getPusherClient(): PusherClient | null {
  if (pusherClient !== undefined) {
    return pusherClient;
  }

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  pusherClient = key && cluster ? new PusherClient(key, { cluster }) : null;
  return pusherClient;
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
 * including this same client (it doesn't unsubscribe until the component
 * unmounts, which hasn't happened yet while the action is still in
 * flight). Without suppressing it, that self-triggered refresh would
 * re-render RoomPage as a genuine navigation — with this player now absent
 * from the participant list — and its auto-join-on-visit logic (CLAUDE.md
 * section 14) would silently add them right back before the router
 * finishes navigating them away.
 */
export function useRoomRealtime(
  roomId: string,
  suppressRefreshRef?: RefObject<boolean>,
): void {
  const router = useRouter();

  useEffect(() => {
    const client = getPusherClient();
    if (!client || !roomId) {
      return;
    }

    const channelName = `room-${roomId}`;
    const channel = client.subscribe(channelName);

    const handleUpdate = () => {
      if (suppressRefreshRef?.current) {
        return;
      }
      router.refresh();
    };
    channel.bind("room:update", handleUpdate);

    return () => {
      channel.unbind("room:update", handleUpdate);
      client.unsubscribe(channelName);
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
    const client = getPusherClient();
    if (!client || !gameId) {
      return;
    }

    const channelName = `game-${gameId}`;
    const channel = client.subscribe(channelName);

    const handleUpdate = () => router.refresh();
    channel.bind("game:update", handleUpdate);

    return () => {
      channel.unbind("game:update", handleUpdate);
      client.unsubscribe(channelName);
    };
  }, [gameId, router]);
}
