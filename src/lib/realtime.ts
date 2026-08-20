/**
 * Bridge to the Socket.io server instance created in `server.js`.
 *
 * `server.js` runs as a plain Node process (outside Next.js' own module
 * bundler) and stores the io instance on `globalThis` after creating it.
 * Server Actions and Route Handlers are bundled separately by Next.js, so
 * they can't import the io instance directly — but they run in the same
 * Node process, and `globalThis` is shared regardless of which module
 * system loaded the code. That's the only reason this goes through
 * `globalThis` instead of a normal module-level singleton.
 *
 * When the app runs without the custom server (e.g. `next build` during
 * static analysis, or a deployment that doesn't wire up server.js), the io
 * instance is simply absent and every emit below becomes a no-op — the
 * realtime layer is a "something changed, please refetch" signal on top of
 * the server-authoritative state, never a requirement for correctness.
 */

import type { Server } from "socket.io";

declare global {
  // eslint-disable-next-line no-var
  var __wordleSocketIO: Server | undefined;
}

/**
 * Notify every client watching a room's lobby that something changed
 * (a player joined/left, a word was submitted, the host started the
 * match). Clients react by refreshing their server-rendered data — the
 * socket event never carries game state itself.
 */
export function emitRoomUpdate(roomId: string): void {
  globalThis.__wordleSocketIO?.to(`room:${roomId}`).emit("room:update");
}

/**
 * Notify every client watching a game (active players and the round's
 * spectator) that something changed (a new attempt, a round finished, the
 * next round started, the match ended).
 */
export function emitGameUpdate(gameId: string): void {
  globalThis.__wordleSocketIO?.to(`game:${gameId}`).emit("game:update");
}
