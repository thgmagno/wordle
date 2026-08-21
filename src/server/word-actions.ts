"use server";

import { auth } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { MIN_WORD_LENGTH, MAX_WORD_LENGTH } from "@/lib/word-normalization";
import {
  getRandomCommonWord,
  validateAnswerWord,
  validateAttemptWord,
} from "./word-service";

export async function validateAnswerWordAction(word: string, expectedLength: number) {
  return validateAnswerWord(word, expectedLength);
}

export async function validateAttemptWordAction(word: string, expectedLength: number) {
  return validateAttemptWord(word, expectedLength);
}

/**
 * Suggest a random dictionary word for the "sortear" button on the secret
 * word form — pure UX convenience, not a security boundary: whatever word
 * comes back still goes through the same submitWord -> validateAnswerWord
 * path as anything the user typed by hand, so there's nothing here for the
 * final submission to trust. Requires auth (matches every other room
 * action) and is rate-limited per user since the button is designed to be
 * mashed repeatedly until the player likes a suggestion.
 *
 * Reuses getRandomCommonWord — the same "biased toward recognizable
 * vocabulary" picker single-player uses to draw its answer — so a player
 * choosing their secret word doesn't get handed some obscure dictionary
 * entry nobody would ever guess.
 */
export async function getRandomWordSuggestionAction(
  wordLength: number,
): Promise<{ success: boolean; word?: string; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "Você precisa estar autenticado" };
  }

  if (
    !Number.isInteger(wordLength) ||
    wordLength < MIN_WORD_LENGTH ||
    wordLength > MAX_WORD_LENGTH
  ) {
    return {
      success: false,
      error: `O comprimento da palavra deve ser entre ${MIN_WORD_LENGTH} e ${MAX_WORD_LENGTH}`,
    };
  }

  const rateLimit = await checkRateLimit(
    `random-word-suggestion-${userId}`,
    RATE_LIMIT_CONFIGS.RANDOM_WORD_SUGGESTION,
  );

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: rateLimit.message || "Limite de sorteios atingido",
    };
  }

  const word = await getRandomCommonWord(wordLength);

  if (!word) {
    return {
      success: false,
      error: "Nenhuma palavra disponível para esse tamanho",
    };
  }

  return { success: true, word: word.word };
}
