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
 * Re-pulls fresh server state — and nudges the Pusher connection back to
 * life if it isn't already — the moment the tab becomes visible again.
 * Returns the listeners' own cleanup function, for the caller's effect to
 * return.
 *
 * Mobile browsers aggressively suspend backgrounded tabs: JS timers stop
 * and the WebSocket connection is frequently dropped outright. Switching
 * away from the app — the home button, the app switcher, a phone call —
 * and back is extremely common on mobile, and it can leave a realtime
 * subscription silently dead: Pusher's own reconnect logic can't run
 * while the tab is suspended, and whatever "room:update"/"game:update"
 * events fired on the server during that gap are just gone — Pusher
 * doesn't replay missed events on reconnect. A `useEffect` that runs once
 * on mount doesn't help here, despite how it might seem like it should:
 * the component never unmounts just because the tab was backgrounded, so
 * a mount-only effect never gets a chance to re-fire. Listening for the
 * tab's own visibility instead catches exactly the moment that matters,
 * whether or not Pusher itself ever noticed the gap. `pageshow` is added
 * alongside `visibilitychange` as a second signal for the same event,
 * covering Safari's back/forward cache restoring the whole page — JS
 * state and all — without a normal mount ever happening.
 */
function bindForegroundRefresh(
  client: PusherClient,
  router: ReturnType<typeof useRouter>,
  suppressRefreshRef?: RefObject<boolean>,
): () => void {
  const handleForeground = () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    if (suppressRefreshRef?.current) {
      return;
    }
    if (client.connection.state !== "connected") {
      client.connect();
    }
    router.refresh();
  };

  document.addEventListener("visibilitychange", handleForeground);
  window.addEventListener("pageshow", handleForeground);

  return () => {
    document.removeEventListener("visibilitychange", handleForeground);
    window.removeEventListener("pageshow", handleForeground);
  };
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

    const unbindForegroundRefresh = bindForegroundRefresh(client, router, suppressRefreshRef);

    return () => {
      channel.unbind("room:update", handleUpdate);
      client.unsubscribe(channelName);
      unbindForegroundRefresh();
    };
  }, [roomId, router, suppressRefreshRef]);
}

// Matches the fixed channel name in src/lib/realtime.ts — see that file's
// comment for why this one isn't parameterized like room-*/game-* above.
const PUBLIC_ROOMS_CHANNEL = "public-rooms";

/**
 * Subscribes to realtime updates for the dashboard's "Salas Públicas"
 * browser. Any "public-rooms:update" event (emitted whenever a room is
 * created, its visibility is toggled, someone joins/leaves, a match
 * starts, or a finished room reopens via "Jogar Novamente" — see
 * emitPublicRoomsUpdate's callers) triggers a Server Component refresh,
 * so a newly public room appears — or a closed/started one disappears —
 * without the user having to reload the page.
 */
export function usePublicRoomsRealtime(): void {
  const router = useRouter();

  useEffect(() => {
    const client = getPusherClient();
    if (!client) {
      return;
    }

    const channel = client.subscribe(PUBLIC_ROOMS_CHANNEL);

    const handleUpdate = () => router.refresh();
    channel.bind("public-rooms:update", handleUpdate);

    const unbindForegroundRefresh = bindForegroundRefresh(client, router);

    return () => {
      channel.unbind("public-rooms:update", handleUpdate);
      client.unsubscribe(PUBLIC_ROOMS_CHANNEL);
      unbindForegroundRefresh();
    };
  }, [router]);
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

    const unbindForegroundRefresh = bindForegroundRefresh(client, router);

    return () => {
      channel.unbind("game:update", handleUpdate);
      client.unsubscribe(channelName);
      unbindForegroundRefresh();
    };
  }, [gameId, router]);
}
