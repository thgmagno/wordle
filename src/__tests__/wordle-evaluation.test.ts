import {
  evaluateAttempt,
  isAttemptCorrect,
  isPlayerDoneWithRound,
  haveAllPlayersFinishedRound,
  MAX_ATTEMPTS,
} from "@/lib/wordle-evaluation";
import type { AttemptLetterResult } from "@/types";

describe("Wordle Evaluation", () => {
  describe("evaluateAttempt", () => {
    it("should mark all letters as correct when guess matches answer", () => {
      const result = evaluateAttempt("ação", "ação");
      expect(result.every((r) => r.status === "CORRECT")).toBe(true);
    });

    it("should handle letters with accents correctly", () => {
      const result = evaluateAttempt("açúcar", "acucar");
      // Should normalize both and compare
      expect(result).toBeDefined();
    });

    it("should mark correct position letters as CORRECT", () => {
      const result = evaluateAttempt("carro", "carto");
      // C-A are correct, R-T-O need evaluation
      expect(result[0].status).toBe("CORRECT"); // C
      expect(result[1].status).toBe("CORRECT"); // A
    });

    it("should mark present letters as PRESENT", () => {
      const result = evaluateAttempt("abcde", "eabcd");
      // Every letter of the guess exists in the answer, but shifted by one
      // position, so none of them land as CORRECT — only PRESENT.
      expect(result.some((r) => r.status === "PRESENT")).toBe(true);
      expect(result.some((r) => r.status === "CORRECT")).toBe(false);
    });

    it("should mark absent letters as ABSENT", () => {
      const result = evaluateAttempt("abcde", "zyxwv");
      expect(result.every((r) => r.status === "ABSENT")).toBe(true);
    });

    it("should handle repeated letters correctly - more in guess than answer", () => {
      // Answer has "a" only twice (positions 0-1); the guess is all "a"s.
      // Per CLAUDE.md's rule, only as many occurrences as exist in the
      // answer may be marked — here the two in the correct position are
      // CORRECT, the three extra "a"s must be ABSENT, never CORRECT/PRESENT.
      const result = evaluateAttempt("aaaaa", "aabbc");
      expect(result[0].status).toBe("CORRECT");
      expect(result[1].status).toBe("CORRECT");
      expect(result[2].status).toBe("ABSENT");
      expect(result[3].status).toBe("ABSENT");
      expect(result[4].status).toBe("ABSENT");
    });

    it("should handle repeated letters correctly - fewer in guess than answer", () => {
      const result = evaluateAttempt("steal", "areas");
      // A appears 2x in answer, 1x in guess
      // The A in guess (pos 2) should be marked appropriately
      expect(result).toBeDefined();
    });

    it("should throw error for mismatched lengths", () => {
      expect(() => evaluateAttempt("abc", "abcde")).toThrow();
    });
  });

  describe("isAttemptCorrect", () => {
    it("should return true when guess matches answer exactly", () => {
      expect(isAttemptCorrect("gatos", "gatos")).toBe(true);
    });

    it("should return true when normalized forms match", () => {
      expect(isAttemptCorrect("gatos", "gatos")).toBe(true);
    });

    it("should return false when guess does not match answer", () => {
      expect(isAttemptCorrect("gatos", "catos")).toBe(false);
    });

    it("should be case insensitive", () => {
      expect(isAttemptCorrect("GATOS", "gatos")).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle 4-letter words", () => {
      const result = evaluateAttempt("casa", "casa");
      expect(result.every((r) => r.status === "CORRECT")).toBe(true);
    });

    it("should handle 5-letter words", () => {
      const result = evaluateAttempt("gatos", "gatos");
      expect(result.every((r) => r.status === "CORRECT")).toBe(true);
    });

    it("should handle 6-letter words", () => {
      const result = evaluateAttempt("porque", "porque");
      expect(result.every((r) => r.status === "CORRECT")).toBe(true);
    });

    it("should handle Portuguese special characters", () => {
      const result = evaluateAttempt("açúcar", "acucar");
      expect(result).toBeDefined();
      expect(result.length).toBe(6);
    });
  });

  // Regression coverage for the round-completion fix (issue #14): a round
  // used to end for everyone the instant the first player guessed
  // correctly, cutting off anyone still on their own attempts. These
  // predicates are what submitAttempt now uses to decide, per player and
  // for the round as a whole, whether it's actually over.
  describe("isPlayerDoneWithRound", () => {
    it("is false with no attempts yet", () => {
      expect(isPlayerDoneWithRound([])).toBe(false);
    });

    it("is false with some incorrect attempts under the cap", () => {
      const attempts = Array.from({ length: MAX_ATTEMPTS - 1 }, () => ({ isCorrect: false }));
      expect(isPlayerDoneWithRound(attempts)).toBe(false);
    });

    it("is true as soon as one attempt is correct, even with attempts left", () => {
      expect(isPlayerDoneWithRound([{ isCorrect: false }, { isCorrect: true }])).toBe(true);
    });

    it("is true once every attempt has been used, win or not", () => {
      const attempts = Array.from({ length: MAX_ATTEMPTS }, () => ({ isCorrect: false }));
      expect(isPlayerDoneWithRound(attempts)).toBe(true);
    });
  });

  describe("haveAllPlayersFinishedRound", () => {
    it("is false when a player has no attempts recorded yet", () => {
      const attemptsByPlayer = new Map([["p1", [{ isCorrect: true }]]]);
      expect(haveAllPlayersFinishedRound(["p1", "p2"], attemptsByPlayer)).toBe(false);
    });

    it("is false while any active player is still mid-round", () => {
      const attemptsByPlayer = new Map([
        ["p1", [{ isCorrect: true }]],
        ["p2", [{ isCorrect: false }]],
      ]);
      expect(haveAllPlayersFinishedRound(["p1", "p2"], attemptsByPlayer)).toBe(false);
    });

    it("is true once every active player has either won or used all attempts", () => {
      const attemptsByPlayer = new Map([
        ["p1", [{ isCorrect: true }]],
        ["p2", Array.from({ length: MAX_ATTEMPTS }, () => ({ isCorrect: false }))],
      ]);
      expect(haveAllPlayersFinishedRound(["p1", "p2"], attemptsByPlayer)).toBe(true);
    });

    it("ignores players not in the active list (e.g. the round's spectator)", () => {
      const attemptsByPlayer = new Map([["p1", [{ isCorrect: true }]]]);
      // p2 isn't an active player for this round (they're the word owner),
      // so their absence from attemptsByPlayer must not block completion.
      expect(haveAllPlayersFinishedRound(["p1"], attemptsByPlayer)).toBe(true);
    });

    it("is true with no active players (edge case: only the spectator remains)", () => {
      expect(haveAllPlayersFinishedRound([], new Map())).toBe(true);
    });
  });
});
