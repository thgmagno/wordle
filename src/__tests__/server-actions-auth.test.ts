/**
 * Regression coverage for issue #8: every mutating Server Action must
 * derive the acting user from the server-side session, not from a
 * parameter a client could forge. The most direct way to test that is to
 * mock the session as absent and confirm each action refuses to do
 * anything — no Prisma call, no side effect, just the "not authenticated"
 * response — before it ever gets a chance to trust anything the caller
 * passed in.
 *
 * `auth()` is the very first thing every one of these functions calls, so
 * mocking it to resolve `null` is enough; none of them should reach
 * Prisma, rate limiting, or realtime emission in that case.
 */

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

import { auth } from "@/lib/auth";
import { createRoom, joinRoom, leaveRoom, submitWord, startGame } from "@/server/room-actions";
import {
  submitAttempt,
  getGameState,
  getRoundInfo,
  getUserAttempts,
  advanceToNextRound,
} from "@/server/game-actions";
import { updateLeaderboardVisibility } from "@/server/ranking-actions";
import {
  startSinglePlayerGame,
  submitSinglePlayerAttempt,
  getSinglePlayerGameState,
  getActiveSinglePlayerGame,
} from "@/server/single-player-actions";

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const UNAUTHENTICATED_ERROR = "Você precisa estar autenticado";

describe("Server Actions reject unauthenticated callers", () => {
  beforeEach(() => {
    mockedAuth.mockReset();
    mockedAuth.mockResolvedValue(null);
  });

  it("createRoom", async () => {
    await expect(createRoom(5)).resolves.toEqual({
      success: false,
      error: UNAUTHENTICATED_ERROR,
    });
  });

  it("joinRoom", async () => {
    await expect(joinRoom("room-1")).resolves.toEqual({
      success: false,
      error: UNAUTHENTICATED_ERROR,
    });
  });

  it("leaveRoom", async () => {
    await expect(leaveRoom("room-1")).resolves.toEqual({
      success: false,
      error: UNAUTHENTICATED_ERROR,
    });
  });

  it("submitWord", async () => {
    await expect(submitWord("room-1", "word-1", "gatos")).resolves.toEqual({
      success: false,
      error: UNAUTHENTICATED_ERROR,
    });
  });

  it("startGame", async () => {
    await expect(startGame("room-1")).resolves.toEqual({
      success: false,
      error: UNAUTHENTICATED_ERROR,
    });
  });

  it("submitAttempt", async () => {
    await expect(submitAttempt("round-1", "gatos")).resolves.toEqual({
      success: false,
      error: UNAUTHENTICATED_ERROR,
    });
  });

  it("advanceToNextRound", async () => {
    await expect(advanceToNextRound("game-1")).resolves.toEqual({
      success: false,
      error: UNAUTHENTICATED_ERROR,
    });
  });

  it("updateLeaderboardVisibility", async () => {
    await expect(updateLeaderboardVisibility(true)).resolves.toEqual({
      success: false,
      error: UNAUTHENTICATED_ERROR,
    });
  });

  it("startSinglePlayerGame", async () => {
    await expect(startSinglePlayerGame(5)).resolves.toEqual({
      success: false,
      error: UNAUTHENTICATED_ERROR,
    });
  });

  it("submitSinglePlayerAttempt", async () => {
    await expect(submitSinglePlayerAttempt("game-1", "gatos")).resolves.toEqual({
      success: false,
      error: UNAUTHENTICATED_ERROR,
    });
  });

  it("getSinglePlayerGameState returns null", async () => {
    await expect(getSinglePlayerGameState("game-1")).resolves.toBeNull();
  });

  it("getActiveSinglePlayerGame returns null", async () => {
    await expect(getActiveSinglePlayerGame()).resolves.toBeNull();
  });

  // Read-only getters don't return a {success, error} shape — they just
  // withhold data (null / empty) from an unauthenticated caller, which
  // matters here because getGameState/getRoundInfo also gate whether the
  // secret answer word is included in the response.
  it("getGameState returns null", async () => {
    await expect(getGameState("game-1")).resolves.toBeNull();
  });

  it("getRoundInfo returns null", async () => {
    await expect(getRoundInfo("round-1")).resolves.toBeNull();
  });

  it("getUserAttempts returns an empty array", async () => {
    await expect(getUserAttempts("round-1")).resolves.toEqual([]);
  });
});
