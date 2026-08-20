/**
 * Custom Node server for Next.js + Socket.io.
 *
 * A plain `next dev`/`next start` process has no long-lived connection to
 * attach WebSockets to (App Router route handlers are request/response,
 * not persistent). This wraps the same Next.js request handler in a raw
 * HTTP server so a Socket.io server can share the same port — the
 * approach documented by both Next.js and Socket.io for this combination.
 *
 * The Socket.io server itself carries no game state and authorizes
 * nothing: it only relays "something changed" signals for rooms
 * (`room:<roomId>`) and games (`game:<gameId>`) so connected clients know
 * to refetch the real (server-authoritative) state via the normal
 * Next.js data layer. See src/lib/realtime.ts for how Server Actions
 * reach this instance to emit those signals.
 */

const { createServer } = require("node:http");
const { Server } = require("socket.io");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = Number(process.env.PORT) || 3000;
const socketPath = process.env.NEXT_PUBLIC_SOCKET_IO_PATH || "/socket.io";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const httpServer = createServer((req, res) => {
      handle(req, res);
    });

    const io = new Server(httpServer, {
      path: socketPath,
    });

    io.on("connection", (socket) => {
      // Rooms are joined/left explicitly by the client so a socket only
      // receives updates for the lobby/game it's actually looking at.
      socket.on("room:join", (roomId) => {
        if (typeof roomId === "string" && roomId) {
          socket.join(`room:${roomId}`);
        }
      });

      socket.on("room:leave", (roomId) => {
        if (typeof roomId === "string" && roomId) {
          socket.leave(`room:${roomId}`);
        }
      });

      socket.on("game:join", (gameId) => {
        if (typeof gameId === "string" && gameId) {
          socket.join(`game:${gameId}`);
        }
      });

      socket.on("game:leave", (gameId) => {
        if (typeof gameId === "string" && gameId) {
          socket.leave(`game:${gameId}`);
        }
      });
    });

    globalThis.__wordleSocketIO = io;

    httpServer.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port} (socket.io path: ${socketPath})`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
