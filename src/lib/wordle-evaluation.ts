import type { AttemptLetterResult } from "@/types";
import {
  getCharacterFrequency,
  normalizeWord,
} from "./word-normalization";

/**
 * Maximum guesses a player gets per round, regardless of word length.
 * Single source of truth for both the server (which must actually enforce
 * it) and the client (grid/keyboard rendering).
 */
export const MAX_ATTEMPTS = 6;

/**
 * A player has finished their part of a round once they've either solved
 * it or used every attempt they're allowed. Pure predicate over just
 * their own attempts, so it's usable both server-side (deciding whether a
 * new attempt from them is still allowed, and whether the round as a
 * whole can finish) and in tests without touching the database.
 */
export function isPlayerDoneWithRound(
  playerAttempts: Array<{ isCorrect: boolean }>
): boolean {
  return (
    playerAttempts.some((a) => a.isCorrect) ||
    playerAttempts.length >= MAX_ATTEMPTS
  );
}

/**
 * A round is over for everyone once every active, non-spectator player has
 * finished it (see isPlayerDoneWithRound) — a player with zero attempts
 * yet is not done. `attemptsByPlayer` need not have an entry for every id
 * in `activePlayerIds`; a missing entry is treated as "no attempts yet".
 */
export function haveAllPlayersFinishedRound(
  activePlayerIds: string[],
  attemptsByPlayer: Map<string, Array<{ isCorrect: boolean }>>
): boolean {
  return activePlayerIds.every((id) =>
    isPlayerDoneWithRound(attemptsByPlayer.get(id) ?? [])
  );
}

/**
 * Evaluates a Wordle attempt against the answer word
 * Correctly handles repeated letters according to Wordle rules
 */
export function evaluateAttempt(
  attempt: string,
  answer: string
): AttemptLetterResult[] {
  const normalizedAttempt = normalizeWord(attempt);
  const normalizedAnswer = normalizeWord(answer);

  if (normalizedAttempt.length !== normalizedAnswer.length) {
    throw new Error(
      `A tentativa e a resposta devem ter o mesmo comprimento. Tentativa: ${normalizedAttempt.length}, Resposta: ${normalizedAnswer.length}`
    );
  }

  const length = normalizedAnswer.length;
  const result: AttemptLetterResult[] = Array(length).fill(null);
  const answerCharFrequency = getCharacterFrequency(normalizedAnswer);
  const remainingFrequency = new Map(answerCharFrequency);

  // First pass: Mark CORRECT (green) letters
  for (let i = 0; i < length; i++) {
    const attemptChar = normalizedAttempt[i];
    const answerChar = normalizedAnswer[i];

    if (attemptChar === answerChar) {
      result[i] = {
        letter: normalizedAttempt[i],
        status: "CORRECT",
      };
      remainingFrequency.set(attemptChar, (remainingFrequency.get(attemptChar) || 0) - 1);
    }
  }

  // Second pass: Mark PRESENT (yellow) and ABSENT (gray) letters
  for (let i = 0; i < length; i++) {
    if (result[i] !== null) continue; // Already marked as CORRECT

    const attemptChar = normalizedAttempt[i];
    const remainingCount = remainingFrequency.get(attemptChar) || 0;

    if (remainingCount > 0) {
      result[i] = {
        letter: normalizedAttempt[i],
        status: "PRESENT",
      };
      remainingFrequency.set(attemptChar, remainingCount - 1);
    } else {
      result[i] = {
        letter: normalizedAttempt[i],
        status: "ABSENT",
      };
    }
  }

  return result;
}

/**
 * Check if an attempt is correct
 */
export function isAttemptCorrect(
  attempt: string,
  answer: string
): boolean {
  const result = evaluateAttempt(attempt, answer);
  return result.every((r) => r.status === "CORRECT");
}

/**
 * Get keyboard state after an attempt
 * Maps each character to its best status (CORRECT > PRESENT > ABSENT)
 */
export function getKeyboardState(
  attempts: Array<{ attemptText: string; result: AttemptLetterResult[] }>
): Map<string, "CORRECT" | "PRESENT" | "ABSENT"> {
  const keyboardState = new Map<string, "CORRECT" | "PRESENT" | "ABSENT">();
  const statusRank = { CORRECT: 3, PRESENT: 2, ABSENT: 1 };

  for (const { result } of attempts) {
    for (const { letter, status } of result) {
      const currentRank = statusRank[keyboardState.get(letter) || "ABSENT"];
      const newRank = statusRank[status];

      if (newRank > currentRank) {
        keyboardState.set(letter, status);
      }
    }
  }

  return keyboardState;
}

/**
 * Validate if a word can be used as an answer
 * (should be in dictionary, not negative, correct length)
 */
export function canUseAsAnswerWord(
  word: string,
  options: {
    isInDictionary: boolean;
    isNegative: boolean;
    expectedLength: number;
  }
): { valid: boolean; error?: string } {
  const normalizedWord = normalizeWord(word);

  if (normalizedWord.length !== options.expectedLength) {
    return {
      valid: false,
      error: `A palavra deve ter exatamente ${options.expectedLength} letras`,
    };
  }

  if (!options.isInDictionary) {
    return {
      valid: false,
      error: "A palavra não está no dicionário",
    };
  }

  if (options.isNegative) {
    return {
      valid: false,
      error: "Esta palavra não pode ser usada (palavra bloqueada)",
    };
  }

  return { valid: true };
}

/**
 * Validate if a word can be used as an attempt
 */
export function canUseAsAttemptWord(
  word: string,
  options: {
    isInDictionary: boolean;
    isNegative: boolean;
    expectedLength: number;
    previousAttempts?: string[];
  }
): { valid: boolean; error?: string } {
  const normalizedWord = normalizeWord(word);

  if (normalizedWord.length !== options.expectedLength) {
    return {
      valid: false,
      error: `A palavra deve ter exatamente ${options.expectedLength} letras`,
    };
  }

  if (!options.isInDictionary) {
    return {
      valid: false,
      error: "A palavra não está no dicionário",
    };
  }

  if (options.isNegative) {
    return {
      valid: false,
      error: "Esta palavra não pode ser usada (palavra bloqueada)",
    };
  }

  if (options.previousAttempts) {
    const previousNormalized = options.previousAttempts.map((a) => normalizeWord(a));
    if (previousNormalized.includes(normalizedWord)) {
      return {
        valid: false,
        error: "Você já tentou esta palavra",
      };
    }
  }

  return { valid: true };
}
