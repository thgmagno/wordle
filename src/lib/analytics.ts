/**
 * Analytics Service
 *
 * Rastreia eventos importantes do jogo para análise e insights
 * Dados armazenados no MongoDB para análise histórica
 */

interface AnalyticsEvent {
  type: string;
  userId?: string;
  timestamp: Date;
  data: Record<string, any>;
  session?: string;
}

/**
 * Events que rastreamos
 */
export type AnalyticsEventType =
  | "game_created"
  | "game_joined"
  | "game_started"
  | "game_finished"
  | "round_started"
  | "round_finished"
  | "attempt_submitted"
  | "word_submitted"
  | "user_registered"
  | "user_logged_in"
  | "user_logged_out"
  | "leaderboard_viewed"
  | "profile_viewed"
  | "settings_changed"
  | "error_occurred";

/**
 * Track an analytics event
 */
export async function trackEvent(
  type: AnalyticsEventType,
  userId: string | undefined,
  data: Record<string, any> = {}
) {
  // Em desenvolvimento, apenas log
  if (process.env.NODE_ENV === "development") {
    console.log(`📊 Analytics Event: ${type}`, { userId, ...data });
    return;
  }

  // Em produção, enviar para backend
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        userId,
        data,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("Failed to track event:", error);
  }
}

/**
 * Game Analytics
 */
export const gameAnalytics = {
  async gameCreated(hostId: string, wordLength: number) {
    await trackEvent("game_created", hostId, { wordLength });
  },

  async gameJoined(userId: string, gameId: string) {
    await trackEvent("game_joined", userId, { gameId });
  },

  async gameStarted(hostId: string, gameId: string, participantCount: number) {
    await trackEvent("game_started", hostId, { gameId, participantCount });
  },

  async gameFinished(
    hostId: string,
    gameId: string,
    duration: number,
    participantCount: number,
    winner?: string
  ) {
    await trackEvent("game_finished", hostId, {
      gameId,
      duration,
      participantCount,
      winner,
    });
  },

  async roundStarted(userId: string, roundId: string, roundNumber: number) {
    await trackEvent("round_started", userId, { roundId, roundNumber });
  },

  async roundFinished(
    userId: string,
    roundId: string,
    attemptsUsed: number,
    score: number
  ) {
    await trackEvent("round_finished", userId, {
      roundId,
      attemptsUsed,
      score,
    });
  },

  async attemptSubmitted(
    userId: string,
    roundId: string,
    attemptNumber: number,
    isCorrect: boolean
  ) {
    await trackEvent("attempt_submitted", userId, {
      roundId,
      attemptNumber,
      isCorrect,
    });
  },

  async wordSubmitted(userId: string, roomId: string, wordLength: number) {
    await trackEvent("word_submitted", userId, { roomId, wordLength });
  },
};

/**
 * User Analytics
 */
export const userAnalytics = {
  async userRegistered(userId: string) {
    await trackEvent("user_registered", userId, {});
  },

  async userLoggedIn(userId: string) {
    await trackEvent("user_logged_in", userId, {});
  },

  async userLoggedOut(userId: string) {
    await trackEvent("user_logged_out", userId, {});
  },

  async leaderboardViewed(userId: string | undefined, page: number) {
    await trackEvent("leaderboard_viewed", userId, { page });
  },

  async profileViewed(userId: string | undefined, profileUserId: string) {
    await trackEvent("profile_viewed", userId, { profileUserId });
  },

  async settingsChanged(userId: string, setting: string, value: any) {
    await trackEvent("settings_changed", userId, { setting, value });
  },
};

/**
 * Error Analytics
 */
export async function trackError(
  error: Error,
  context: string,
  userId?: string
) {
  await trackEvent("error_occurred", userId, {
    error: error.message,
    stack: error.stack,
    context,
  });
}

/**
 * Calculate game metrics
 */
export async function getGameMetrics(gameId: string) {
  try {
    const response = await fetch(`/api/analytics/game/${gameId}`);
    if (!response.ok) throw new Error("Failed to fetch game metrics");
    return await response.json();
  } catch (error) {
    console.error("Failed to get game metrics:", error);
    return null;
  }
}

/**
 * Calculate user metrics
 */
export async function getUserMetrics(userId: string) {
  try {
    const response = await fetch(`/api/analytics/user/${userId}`);
    if (!response.ok) throw new Error("Failed to fetch user metrics");
    return await response.json();
  } catch (error) {
    console.error("Failed to get user metrics:", error);
    return null;
  }
}

/**
 * Get global metrics
 */
export async function getGlobalMetrics() {
  try {
    const response = await fetch("/api/analytics/global");
    if (!response.ok) throw new Error("Failed to fetch global metrics");
    return await response.json();
  } catch (error) {
    console.error("Failed to get global metrics:", error);
    return null;
  }
}
