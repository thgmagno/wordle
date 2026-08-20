// User & Authentication
export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  showInLeaderboard: boolean;
}

// Game States
export type RoomStatus = "LOBBY" | "IN_PROGRESS" | "FINISHED";
export type GameStatus = "ACTIVE" | "FINISHED";
export type RoundStatus = "ACTIVE" | "FINISHED";
export type ParticipantStatus = "ACTIVE" | "LEFT" | "KICKED";

// Game Interface
export interface Room {
  id: string;
  hostId: string;
  wordLength: number; // 4, 5, or 6
  status: RoomStatus;
  maxPlayers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  joinedAt: Date;
  status: ParticipantStatus;
}

export interface SubmittedWord {
  id: string;
  roomId: string;
  userId: string;
  wordId: string;
  wordText: string;
  submittedAt: Date;
}

// Game & Rounds
export interface Game {
  id: string;
  roomId: string;
  status: GameStatus;
  totalRounds: number;
  currentRound: number;
  createdAt: Date;
  endedAt: Date | null;
}

export interface Round {
  id: string;
  gameId: string;
  roundNumber: number;
  answerWordId: string;
  answerWord: string;
  wordOwnerId: string;
  status: RoundStatus;
  createdAt: Date;
  endedAt: Date | null;
}

export interface RoundAttempt {
  id: string;
  roundId: string;
  userId: string;
  attemptText: string;
  attemptNumber: number;
  result: AttemptLetterResult[];
  isCorrect: boolean;
  createdAt: Date;
}

export interface AttemptLetterResult {
  letter: string;
  status: "CORRECT" | "PRESENT" | "ABSENT";
}

// Scoring
export interface MatchScore {
  id: string;
  gameId: string;
  userId: string;
  finalScore: number;
  placement: number | null;
  roundScores: RoundScoreEntry[];
}

export interface RoundScoreEntry {
  roundNumber: number;
  score: number;
  attemptsUsed: number;
}

// User Statistics
export interface UserStatistics {
  id: string;
  userId: string;
  totalGamesPlayed: number;
  totalWins: number;
  totalPoints: number;
  averageScore: number;
  bestScore: number;
  lastGamePlayedAt: Date | null;
}

// Dictionary/Words
export interface Word {
  id: string;
  word: string;
  normalizedWord: string;
  length: number;
  isNegative: boolean;
  category: string | null;
  origin: string | null;
  icfScore: number | null;
  isValid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// WebSocket Events
export interface SocketEventMap {
  // Room events
  "room:user-joined": { userId: string; userName: string };
  "room:user-left": { userId: string };
  "room:word-submitted": { userId: string };
  "room:game-started": { gameId: string };

  // Game events
  "game:round-started": { roundNumber: number; answerWordId: string };
  "game:attempt-made": { userId: string; attemptText: string; result: AttemptLetterResult[] };
  "game:round-ended": { roundNumber: number };
  "game:finished": { finalScores: MatchScore[] };

  // Realtime sync
  "sync:room-state": Room;
  "sync:game-state": Game;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Wordle Evaluation
export interface WordEvaluationResult {
  feedback: AttemptLetterResult[];
  isCorrect: boolean;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
