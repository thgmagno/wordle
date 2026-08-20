/**
 * Server-side bridge to Pusher Channels.
 *
 * Room/game state changes are broadcast through Pusher's REST API rather
 * than a raw Socket.io server on a custom Node process: Vercel (and most
 * serverless hosts) run each Server Action/Route Handler as an isolated,
 * short-lived function invocation with no persistent connection to attach
 * a WebSocket server to, so a long-running `server.js` never actually
 * starts there — every emit silently became a no-op in production. Pusher
 * runs the actual persistent connections on its own infrastructure; this
 * module just does a one-off authenticated HTTP call to tell it "publish
 * this event," which works the same from any serverless invocation.
 *
 * Configuration is optional by design: with no Pusher credentials set,
 * `pusher` below is `null` and every emit becomes a no-op — the realtime
 * layer is a "something changed, please refetch" signal on top of the
 * server-authoritative state, never a requirement for correctness (see
 * src/lib/use-realtime.ts for the client side of that same fallback).
 */

import Pusher from "pusher";
import { logger } from "@/lib/logger";

const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } =
  process.env;

const pusher =
  PUSHER_APP_ID && PUSHER_KEY && PUSHER_SECRET && PUSHER_CLUSTER
    ? new Pusher({
        appId: PUSHER_APP_ID,
        key: PUSHER_KEY,
        secret: PUSHER_SECRET,
        cluster: PUSHER_CLUSTER,
        useTLS: true,
      })
    : null;

// Pusher channel names are restricted to [A-Za-z0-9_\-=@,.;]+ — no colons —
// so these use "-" where the old Socket.io room names used ":".
function roomChannel(roomId: string): string {
  return `room-${roomId}`;
}

function gameChannel(gameId: string): string {
  return `game-${gameId}`;
}

/**
 * Notify every client watching a room's lobby that something changed
 * (a player joined/left, a word was submitted, the host started the
 * match). Clients react by refreshing their server-rendered data — the
 * event never carries game state itself.
 */
export function emitRoomUpdate(roomId: string): void {
  pusher?.trigger(roomChannel(roomId), "room:update", {}).catch((error) => {
    logger.error(
      "realtime",
      "Falha ao publicar atualização de sala via Pusher",
      error as Error,
      { roomId },
    );
  });
}

/**
 * Notify every client watching a game (active players and the round's
 * spectator) that something changed (a new attempt, a round finished, the
 * next round started, the match ended).
 */
export function emitGameUpdate(gameId: string): void {
  pusher?.trigger(gameChannel(gameId), "game:update", {}).catch((error) => {
    logger.error(
      "realtime",
      "Falha ao publicar atualização de jogo via Pusher",
      error as Error,
      { gameId },
    );
  });
}
