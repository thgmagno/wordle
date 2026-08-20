# Wordle Multiplayer - Portuguese Edition

A production-ready multiplayer Wordle game in Brazilian Portuguese with real-time gameplay, global ranking, and comprehensive word dictionary.

## Features

- **Multiplayer Gameplay**: Create rooms and play with friends in real-time
- **Portuguese Dictionary**: 145k+ words from fserb/pt-br repository with proper normalization
- **Real-time Synchronization**: WebSocket-based lobby and game updates
- **Global Ranking**: Compete with players worldwide with privacy controls
- **Authentication**: Google OAuth integration for secure accounts
- **Responsive Design**: Mobile-first interface with light/dark theme support
- **Accessibility**: Keyboard support for both physical and virtual keyboards
- **Security**: Server-side validation for all game-critical operations
- **Error Tracking**: Sentry integration for production error monitoring
- **Analytics**: Comprehensive event tracking for game metrics and user behavior
- **Admin Dashboard**: Real-time metrics visualization with charts and statistics
- **Rate Limiting**: Built-in request rate limiting for API protection
- **Structured Logging**: Category-based logging with multiple severity levels
- **Health Monitoring**: Health check endpoint for uptime monitoring

## Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js Server Components, Server Actions, Node.js
- **Database**: MongoDB with Prisma ORM 7
- **Authentication**: Next-Auth 5 with Google Provider
- **Real-time**: Socket.io for WebSocket communication
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

# WebSocket
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
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
- Filters for 4, 5, and 6-letter words only
- Normalizes Portuguese characters (accents, special characters)
- Identifies blocked/negative words
- Stores ~100k+ valid words in MongoDB
- Is idempotent (safe to run multiple times)

### Development Server

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

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
- Length verification (4, 5, or 6 letters)

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

## Monitoring & Analytics (Phase 8)

### Admin Dashboard
Access the admin dashboard at `/admin` to view real-time metrics:
- **Key Metrics**: Total users, total games, average players per game, online users
- **Games by Word Length**: Pie chart showing distribution of 4, 5, and 6-letter games
- **Daily Trend**: Line chart showing games played over the last 7 days
- **Popular Words**: Bar chart of the 10 most frequently used words
- **Auto-refresh**: Metrics update automatically every 30 seconds

### Error Tracking (Sentry)
Optional Sentry integration for production error monitoring:
```bash
# Install Sentry (optional)
npm install @sentry/nextjs

# Configure in .env.local
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### Analytics Events
The system automatically tracks:
- **Game Events**: game_created, game_joined, game_started, game_finished, round_started, round_finished, attempt_submitted, word_submitted
- **User Events**: user_registered, user_logged_in, user_logged_out, leaderboard_viewed, profile_viewed, settings_changed
- **Error Events**: error_occurred with context and stack trace

Access analytics via:
- `GET /api/analytics/game/:gameId` - Game-level metrics
- `GET /api/analytics/user/:userId` - User-level statistics
- `GET /api/analytics/global` - Global platform metrics

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

### Room Management
- `createRoom(hostId, wordLength)` - Create new game room
- `joinRoom(roomId, userId)` - Join existing room
- `leaveRoom(roomId, userId)` - Leave room
- `submitWord(roomId, userId, wordId, wordText)` - Submit secret word
- `startGame(roomId, hostId)` - Start the game

### Game Mechanics
- `submitAttempt(roundId, userId, attemptText)` - Make a guess
- `getGameState(gameId, userId)` - Get current game state
- `advanceToNextRound(gameId, hostId)` - Move to next round

### Dictionary & Words
- `isWordValid(word)` - Check if word is in dictionary
- `validateAnswerWord(word, length)` - Validate secret word
- `validateAttemptWord(word, length)` - Validate guess
- `getRandomWords(length, count)` - Get random words

### Ranking & Statistics
- `getGlobalRanking(page, limit)` - Get leaderboard
- `getUserStatistics(userId)` - Get player stats
- `getPlayerProfile(userId)` - Get public profile
- `updateLeaderboardVisibility(userId, show)` - Privacy control

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
- MongoDB Atlas or self-hosted MongoDB
- Node.js hosting (Vercel, Railway, etc.)
- Google OAuth credentials

### Vercel Deployment

1. Push to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Run initial deployment
5. Import dictionary via one-time command

### Environment Variables
```
MONGODB_URI
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_SOCKET_URL
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
