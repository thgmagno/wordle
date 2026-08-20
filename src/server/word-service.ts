/**
 * Word Service
 * Server-side logic for managing dictionary words
 */

import { prisma } from "@/lib/prisma";
import {
  compareNormalizedWords,
  getWordLength,
  normalizeWord,
  validateWordFormat,
  isValidWordLength,
} from "@/lib/word-normalization";

/**
 * Get a word by its normalized form
 */
export async function getWordByNormalized(normalizedWord: string) {
  return prisma.word.findUnique({
    where: { normalizedWord },
  });
}

/**
 * Get a word by its original form
 */
export async function getWordByOriginal(word: string) {
  const normalized = normalizeWord(word);
  return getWordByNormalized(normalized);
}

/**
 * Check if a word exists in the dictionary and is valid
 */
export async function isWordValid(
  word: string,
  allowNegative: boolean = false
): Promise<{ valid: boolean; reason?: string }> {
  const validation = validateWordFormat(word);
  if (!validation.valid) {
    return { valid: false, reason: validation.error };
  }

  const dbWord = await getWordByNormalized(validation.normalized!);

  if (!dbWord) {
    return { valid: false, reason: "Word not found in dictionary" };
  }

  if (!dbWord.isValid) {
    return { valid: false, reason: "Word is marked as invalid" };
  }

  if (dbWord.isNegative && !allowNegative) {
    return { valid: false, reason: "Word is blocked" };
  }

  return { valid: true };
}

/**
 * Get random words of a specific length (for game selection)
 */
export async function getRandomWords(
  length: number,
  count: number = 1,
  excludeIds: string[] = []
) {
  return prisma.word.findMany({
    where: {
      length,
      isValid: true,
      isNegative: false,
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
    },
    take: count,
    skip: Math.floor(Math.random() * 100), // Simple randomization
  });
}

/**
 * Get words by length
 */
export async function getWordsByLength(length: number, limit: number = 100) {
  if (!isValidWordLength(length)) {
    throw new Error(`Invalid word length: ${length}. Must be 4, 5, or 6.`);
  }

  return prisma.word.findMany({
    where: {
      length,
      isValid: true,
      isNegative: false,
    },
    take: limit,
  });
}

/**
 * Search words by pattern (for autocomplete, etc)
 */
export async function searchWords(
  pattern: string,
  length?: number,
  limit: number = 20
) {
  const normalizedPattern = normalizeWord(pattern);

  return prisma.word.findMany({
    where: {
      AND: [
        { normalizedWord: { contains: normalizedPattern } },
        length ? { length } : {},
        { isValid: true },
        { isNegative: false },
      ],
    },
    take: limit,
  });
}

/**
 * Get dictionary statistics
 */
export async function getDictionaryStats() {
  const [total, valid, negative, byLength] = await Promise.all([
    prisma.word.count(),
    prisma.word.count({ where: { isValid: true } }),
    prisma.word.count({ where: { isNegative: true } }),
    Promise.all([4, 5, 6].map((len) =>
      prisma.word.count({ where: { length: len, isValid: true, isNegative: false } })
    )),
  ]);

  return {
    totalWords: total,
    validWords: valid,
    negativeWords: negative,
    wordsByLength: {
      4: byLength[0],
      5: byLength[1],
      6: byLength[2],
    },
  };
}

/**
 * Get word info by ID
 */
export async function getWordById(id: string) {
  return prisma.word.findUnique({
    where: { id },
  });
}

/**
 * Validate a word for use as answer (stricter requirements)
 */
export async function validateAnswerWord(
  word: string,
  expectedLength: number
): Promise<{ valid: boolean; error?: string; wordId?: string }> {
  const validation = validateWordFormat(word);
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  if (validation.normalized && validation.normalized.length !== expectedLength) {
    return {
      valid: false,
      error: `Word must have exactly ${expectedLength} letters`,
    };
  }

  const dbWord = await getWordByNormalized(validation.normalized!);

  if (!dbWord) {
    return { valid: false, error: "Word not found in dictionary" };
  }

  if (!dbWord.isValid) {
    return { valid: false, error: "Word is marked as invalid" };
  }

  if (dbWord.isNegative) {
    return { valid: false, error: "Word is blocked" };
  }

  return { valid: true, wordId: dbWord.id };
}

/**
 * Validate a word for use as attempt (user guess)
 */
export async function validateAttemptWord(
  word: string,
  expectedLength: number
): Promise<{ valid: boolean; error?: string }> {
  const validation = validateWordFormat(word);
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  if (validation.normalized && validation.normalized.length !== expectedLength) {
    return {
      valid: false,
      error: `Word must have exactly ${expectedLength} letters`,
    };
  }

  const dbWord = await getWordByNormalized(validation.normalized!);

  if (!dbWord) {
    return { valid: false, error: "Word not found in dictionary" };
  }

  if (dbWord.isNegative) {
    return { valid: false, error: "Word is blocked" };
  }

  return { valid: true };
}

/**
 * Add or update a word in the dictionary
 * Used primarily by the import script
 */
export async function upsertWord(
  word: string,
  options: {
    isNegative?: boolean;
    category?: string;
    origin?: string;
    icfScore?: number;
    isValid?: boolean;
  } = {}
) {
  const { original, normalized } = {
    original: word.trim(),
    normalized: normalizeWord(word),
  };

  return prisma.word.upsert({
    where: { normalizedWord: normalized },
    create: {
      word: original,
      normalizedWord: normalized,
      length: original.length,
      isNegative: options.isNegative || false,
      category: options.category,
      origin: options.origin,
      icfScore: options.icfScore,
      isValid: options.isValid !== false,
    },
    update: {
      word: original,
      isNegative: options.isNegative || false,
      category: options.category || undefined,
      origin: options.origin || undefined,
      icfScore: options.icfScore || undefined,
      isValid: options.isValid !== false,
    },
  });
}

/**
 * Delete a word from dictionary
 */
export async function deleteWord(wordId: string) {
  return prisma.word.delete({
    where: { id: wordId },
  });
}

/**
 * Clear all words (for re-import)
 * DANGEROUS - use with caution
 */
export async function clearAllWords() {
  return prisma.word.deleteMany();
}
