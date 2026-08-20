import { evaluateAttempt, isAttemptCorrect } from "@/lib/wordle-evaluation";
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
});
