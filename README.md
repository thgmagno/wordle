# Wordle Multiplayer - Portuguese Edition

A production-ready multiplayer Wordle game in Brazilian Portuguese with real-time gameplay, global ranking, and comprehensive word dictionary.

## Features

- **Multiplayer Gameplay**: Create rooms and play with friends in real-time
- **Portuguese Dictionary**: 145k+ words from fserb/pt-br repository with proper normalization
- **Real-time Synchronization**: Pusher Channels-based lobby and game updates
- **Global Ranking**: Compete with players worldwide with privacy controls
- **Authentication**: Google OAuth integration for secure accounts
- **Responsive Design**: Mobile-first interface with light/dark theme support
- **Accessibility**: Keyboard support for both physical and virtual keyboards
- **Progressive Web App**: Installable on desktop and mobile, with an offline fallback page
- **Security**: Server-side validation for all game-critical operations
- **Rate Limiting**: Built-in request rate limiting for API protection
- **Structured Logging**: Category-based logging with multiple severity levels
- **Health Monitoring**: Health check endpoint for uptime monitoring

## Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js Server Components, Server Actions, Node.js
- **Database**: MongoDB with Prisma ORM 7
- **Authentication**: Next-Auth 5 with Google Provider
- **Real-time**: Pusher Channels (works on serverless hosts like Vercel — no persistent Node process required)
- **Testing**: Jest for unit tests

## Environment Setup

### Prerequisites

- Node.js 18+ 
- MongoDB instance (local or cloud)
- Google OAuth credentials

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd wordle
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` from `.env.example`:
```bash
cp .env.example .env.local
```

4. Fill in your environment variables:
```env
# Database
MONGODB_URI="mongodb://your-connection-string"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret"

# Google OAuth (get from https://console.cloud.google.com)
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Realtime (Pusher Channels — https://pusher.com, free tier is enough here)
PUSHER_APP_ID="your-app-id"
PUSHER_KEY="your-key"
PUSHER_SECRET="your-secret"
PUSHER_CLUSTER="your-cluster"
NEXT_PUBLIC_PUSHER_KEY="your-key"
NEXT_PUBLIC_PUSHER_CLUSTER="your-cluster"
```

### Database Setup

Generate Prisma client:
```bash
npm run prisma:generate
```

Push schema to MongoDB:
```bash
npm run db:push
```

### Dictionary Import

Import Portuguese words from fserb/pt-br repository:

```bash
npm run dictionary:import
```

This script:
- Downloads words from the fserb/pt-br repository
- Filters for 4-to-10-letter words — the same range the game itself plays
  (see MIN_WORD_LENGTH/MAX_WORD_LENGTH in
  `src/lib/word-normalization.ts` and "Word Validation" below)
- Normalizes Portuguese characters (accents, special characters)
- Identifies blocked/negative words
- Stores ~100k+ valid words in MongoDB
- Is idempotent (safe to run multiple times)

This is **not** wired into the Vercel build — the import re-downloads and
re-diffs the whole upstream lexicon (~145k lines) against everything
already stored on every single run, and a transient GitHub outage while
fetching the source would fail the import itself, not something that
should ever be able to block an unrelated code deploy. Instead,
[`.github/workflows/dictionary-import.yml`](.github/workflows/dictionary-import.yml)
runs it manually, on demand, from the Actions tab → "Dictionary Import" →
Run workflow — no schedule, so it doesn't depend on any one machine being
on for it to happen, but only actually runs when someone means it to. Set
a `MONGODB_URI` repository secret pointing at the production database for
it to have something to write to.

### Development Server

`npm run dev` and `npm run start` run the plain Next.js CLI (`next
dev`/`next start`) — no custom server process. Realtime updates go through
[Pusher Channels](https://pusher.com) instead of a self-hosted WebSocket
server: Server Actions publish an event via its REST API
(`src/lib/realtime.ts`), and the browser subscribes to it directly
(`src/lib/use-realtime.ts`). This is what makes it work unmodified on
serverless hosts like Vercel, where each request runs as an isolated,
short-lived function invocation with nothing to keep a raw Socket.io
server's persistent connections alive.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

Realtime is optional: leave the `PUSHER_*`/`NEXT_PUBLIC_PUSHER_*` variables
unset and the app still runs fully — lobby/game data just only refreshes on
navigation and Server Action responses instead of live, since
`emitRoomUpdate`/`emitGameUpdate` and the client subscription hooks both no-op
without credentials.

### Progressive Web App

The app is installable ("Adicionar à Tela de Início"/"Install app") on
desktop and mobile, via:

- `src/app/manifest.ts` — Next.js's App Router manifest file convention,
  served automatically at `/manifest.webmanifest` and linked into every
  page's `<head>` with no extra setup.
- `src/app/icon.png` / `src/app/apple-icon.png` — Next's icon file
  conventions (browser tab favicon and the iOS home-screen icon,
  respectively), plus `public/icons/*` for the manifest's own icon sizes
  (192px, 512px, and a 512px maskable variant with safe-zone padding for
  Android's adaptive-icon masking). All four are generated from one source
  design by `scripts/generate-pwa-icons.js` — rerun it
  (`node scripts/generate-pwa-icons.js`, needs the `sharp` dependency
  already in `package.json`) whenever the icon design changes; it's a
  one-off generator, not something that runs as part of the build.
- `public/sw.js` — a small service worker, registered in production only
  (see `src/components/service-worker-register.tsx`) by
  `src/app/layout.tsx`. Deliberately narrow in scope: this is a realtime
  multiplayer game where the client is never a trusted source of truth for
  room/game state (see "Security Considerations" below), so the service
  worker only ever caches static, content-hashed build assets
  (`_next/static/*`) and the app's own icons — every page navigation and
  every Server Action call always goes straight to the network, exactly as
  if the service worker didn't exist. Its one behavior beyond that is
  serving `src/app/offline/page.tsx` in place of the browser's own error
  screen when a page navigation fails with no connectivity at all.

### Legacy accounts missing `isGuest`

`User.isGuest` was added to the schema after this app already had real
accounts in production, and Prisma's `@default(false)` only applies to
documents created after that point — it never backfills existing MongoDB
documents. Any account that predates the field has no `isGuest` field
stored at all, which silently excluded it from the global ranking (see
`src/server/ranking-actions.ts`'s `isGuest: false` filter). Run this once
per environment after deploying that fix:

```bash
npm run migrate:backfill-is-guest
```

Idempotent — safe to run again; it only ever touches documents still
missing the field.

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
├── components/          # React components
│   ├── wordle-grid.tsx     # Game board display
│   ├── wordle-keyboard.tsx # Virtual keyboard
│   └── providers.tsx       # Theme provider setup
├── lib/                 # Utilities and core logic
│   ├── word-normalization.ts  # Portuguese text handling
│   ├── wordle-evaluation.ts   # Game rules and evaluation
│   ├── auth.ts             # Authentication config
│   └── prisma.ts           # Database client
├── server/              # Server-side actions
│   ├── room-actions.ts     # Room management
│   ├── game-actions.ts     # Game mechanics
│   ├── word-service.ts     # Dictionary queries
│   └── ranking-actions.ts  # Statistics and leaderboards
├── types/               # TypeScript type definitions
├── __tests__/           # Unit tests
└── prisma/              # Prisma schema

scripts/
└── import-dictionary.js # Dictionary import script
```

## Core Features Implementation

### Game Logic

The Wordle evaluation algorithm correctly handles:
- Correct position detection (green tiles)
- Wrong position detection (yellow tiles)
- Repeated letters with proper frequency counting
- Portuguese accents and special characters

See `src/lib/wordle-evaluation.ts` for implementation.

### Word Validation

Words are validated both client-side and server-side:
- Dictionary lookup via MongoDB
- Blocked word detection
- Portuguese character validation
- Length verification (4 to 10 letters)

### Room Management

- Host-based room creation and control
- Real-time participant synchronization
- Word submission before game starts
- Automatic host reassignment if host leaves

### Game Rounds

- One round per player (player count = round count)
- Each round uses one submitted word
- Word owner plays as spectator in their round
- Automatic scoring based on attempts
- Round advancement controlled by host

### Ranking System

- Points-based leaderboard
- Per-player privacy controls (`showInLeaderboard`)
- Running statistics (games played, wins, average score, best score)
- Placement calculation per game

## Monitoring

### Health Check
Monitor application health at `/api/health`:
```bash
curl http://localhost:3000/api/health
# Returns: { "status": "ok", "uptime": 12345, "timestamp": "..." }
```

### Rate Limiting
Built-in request rate limiting with configurable policies:
- Auth login: 5 requests per 15 minutes
- Word submission: 5 requests per minute
- Game attempts: 1 request per second
- Room creation: 3 requests per 5 minutes

### Structured Logging
Comprehensive logging across 7 categories:
- `auth`: Authentication and authorization events
- `game`: Game state and mechanics events
- `room`: Room management and participant changes
- `word`: Dictionary validation and word operations
- `security`: Security-related events and violations
- `performance`: Performance metrics and monitoring
- `error`: Error tracking and exceptions

## API & Server Actions

Every action below derives the acting user from the server-side session
(`auth()`) instead of taking an id as a parameter — none of them trust a
client-supplied user/host id, so impersonation isn't possible by calling
them directly with a different id (see the security notes above).

### Room Management
- `createRoom(wordLength)` - Create new game room (caller becomes host)
- `joinRoom(roomId)` - Join existing room
- `leaveRoom(roomId)` - Leave room
- `submitWord(roomId, wordId, wordText)` - Submit secret word
- `startGame(roomId)` - Start the game (host only)

### Game Mechanics
- `submitAttempt(roundId, attemptText)` - Make a guess
- `getGameState(gameId)` - Get current game state for the caller
- `advanceToNextRound(gameId)` - Move to next round (host only)

### Dictionary & Words
- `isWordValid(word)` - Check if word is in dictionary
- `validateAnswerWord(word, length)` - Validate secret word
- `validateAttemptWord(word, length)` - Validate guess
- `getRandomWords(length, count)` - Get random words

### Ranking & Statistics
- `getGlobalRanking(page, limit)` - Get leaderboard
- `getUserStatistics(userId)` - Get player stats
- `getPlayerProfile(userId)` - Get public profile (returns `null` for a user who opted out of the leaderboard, unless it's your own)
- `updateLeaderboardVisibility(show)` - Privacy control for the caller

## Testing

Run unit tests:
```bash
npm test
```

Tests include:
- Wordle evaluation algorithm (repeated letters, accents)
- Word normalization (Portuguese characters)
- Word validation and format checking
- Character frequency analysis

## Security Considerations

1. **Server-Side Validation**: All game-critical operations validated on server
2. **Word Privacy**: Secret words never sent to non-spectators
3. **Scoring Protection**: Points calculated server-side only
4. **Authentication**: Google OAuth prevents account takeover
5. **Input Validation**: Strict word format and dictionary validation
6. **Permission Checks**: Host-only operations verified server-side

## Performance Optimizations

1. **Database Indices**: Optimized MongoDB indices for word lookups
2. **Selective Data Loading**: Only necessary data sent to client
3. **Caching**: Prisma query result caching
4. **Batch Operations**: Where possible, use batch database operations
5. **Asset Optimization**: Tailwind CSS purging, Next.js image optimization

## Deployment

### Prerequisites
- MongoDB Atlas or self-hosted MongoDB (must be a replica set — Prisma's
  MongoDB connector requires transactions/upserts, which standalone
  `mongod` doesn't support)
- Node.js hosting (Vercel, Railway, etc.) — the app is plain `next
  dev`/`next start` with no custom server, so any standard Next.js host
  works, serverless included
- Google OAuth credentials
- A [Pusher](https://pusher.com) app (free tier) for realtime updates —
  optional; the app runs without it, just without live lobby/game updates

### Vercel Deployment

1. Push to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Run initial deployment
5. Import dictionary via one-time command
6. After any change to `prisma/schema.prisma`, run `npx prisma db push`
   against the production database once — Vercel's build regenerates the
   Prisma *Client* automatically (see `postinstall` in package.json), but
   nothing pushes schema/index changes to the database itself

### Environment Variables
```
MONGODB_URI
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
PUSHER_APP_ID
PUSHER_KEY
PUSHER_SECRET
PUSHER_CLUSTER
NEXT_PUBLIC_PUSHER_KEY
NEXT_PUBLIC_PUSHER_CLUSTER
NODE_ENV=production
```

## Contributing

1. Create feature branches from main
2. Ensure tests pass: `npm test`
3. Follow existing code style
4. Submit pull requests with clear descriptions

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open GitHub issues or contact the development team.

---

Built with ❤️ for Portuguese word game enthusiasts.
