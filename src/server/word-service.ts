/**
 * Word Service
 * Server-side logic for managing dictionary words
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  compareNormalizedWords,
  getWordLength,
  normalizeWord,
  validateWordFormat,
  isValidWordLength,
  MIN_WORD_LENGTH,
  MAX_WORD_LENGTH,
} from "@/lib/word-normalization";

/** Every word length the game accepts — see MIN/MAX_WORD_LENGTH's comment. */
const PLAYABLE_LENGTHS = Array.from(
  { length: MAX_WORD_LENGTH - MIN_WORD_LENGTH + 1 },
  (_, i) => MIN_WORD_LENGTH + i
);

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
    return { valid: false, reason: "Palavra não encontrada no dicionário" };
  }

  if (!dbWord.isValid) {
    return { valid: false, reason: "A palavra foi marcada como inválida" };
  }

  if (dbWord.isNegative && !allowNegative) {
    return { valid: false, reason: "A palavra está bloqueada" };
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
      length: parseInt(String(length), 10),
      isValid: true,
      isNegative: false,
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
    },
    take: count,
    skip: Math.floor(Math.random() * 100), // Simple randomization
  });
}

/**
 * Get a random word biased toward common, recognizable vocabulary.
 *
 * `getRandomWords` (above) picks uniformly at random from the whole valid
 * pool, which single-player games use to draw an answer with nobody around
 * to vouch that the word "makes sense" — unlike multiplayer, where a human
 * player chose the secret word themselves. Left unfiltered that surfaces
 * archaic/regional/technical dictionary entries (e.g. "acoar") that read as
 * nonsense to most players.
 *
 * There's no reliable flag for "this word is normal" in the dictionary, but
 * `icfScore` (lower = more frequent/common, higher = rarer — see CLAUDE.md
 * section 28) is a reasonable proxy. A fixed score/percentile cutoff would
 * be fragile — it depends on the specific imported corpus and still lets
 * some obscure words through near the boundary. Instead, this samples a
 * random batch of candidates (same skip-based randomization as
 * `getRandomWords`) and returns whichever one in that batch has the lowest
 * icfScore. That's self-correcting — it never returns a genuine outlier
 * unless the whole sample happens to be rare — with no hardcoded threshold
 * to keep in sync with the dictionary.
 */
export async function getRandomCommonWord(
  length: number,
  excludeIds: string[] = [],
  sampleSize: number = 25
) {
  const where = {
    length: parseInt(String(length), 10),
    isValid: true,
    isNegative: false,
    id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
  };

  const total = await prisma.word.count({ where });
  if (total === 0) {
    return null;
  }

  const skip = Math.floor(Math.random() * Math.max(total - sampleSize, 1));

  const candidates = await prisma.word.findMany({
    where,
    take: sampleSize,
    skip: Math.max(0, skip),
  });

  if (candidates.length === 0) {
    return null;
  }

  // A word with no recorded icfScore is treated as maximally rare, so it
  // only gets picked if literally nothing else in the sample has a score.
  type Candidate = (typeof candidates)[number];
  return candidates.reduce((mostCommon: Candidate, candidate: Candidate) => {
    const candidateScore = candidate.icfScore ?? Number.POSITIVE_INFINITY;
    const bestScore = mostCommon.icfScore ?? Number.POSITIVE_INFINITY;
    return candidateScore < bestScore ? candidate : mostCommon;
  });
}

/**
 * Get words by length
 */
export async function getWordsByLength(length: number, limit: number = 100) {
  if (!PLAYABLE_LENGTHS.includes(length)) {
    throw new Error(
      `Tamanho de palavra inválido: ${length}. Deve ser entre ${MIN_WORD_LENGTH} e ${MAX_WORD_LENGTH}.`
    );
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
    Promise.all(PLAYABLE_LENGTHS.map((len) =>
      prisma.word.count({ where: { length: len, isValid: true, isNegative: false } })
    )),
  ]);

  return {
    totalWords: total,
    validWords: valid,
    negativeWords: negative,
    wordsByLength: Object.fromEntries(
      PLAYABLE_LENGTHS.map((len, i) => [len, byLength[i]])
    ) as Record<number, number>,
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
    logger.debug("word", "Invalid word format", { word, error: validation.error });
    return { valid: false, error: validation.error };
  }

  if (validation.normalized && validation.normalized.length !== expectedLength) {
    const error = `A palavra deve ter exatamente ${expectedLength} letras`;
    logger.debug("word", "Word length mismatch", { word, expectedLength, actualLength: validation.normalized.length });
    return { valid: false, error };
  }

  const dbWord = await getWordByNormalized(validation.normalized!);

  if (!dbWord) {
    logger.warn("word", "Word not found in dictionary", { word: validation.normalized, expectedLength }, undefined);
    return { valid: false, error: "Palavra não encontrada no dicionário" };
  }

  if (!dbWord.isValid) {
    logger.warn("word", "Word marked as invalid", { word: dbWord.word, wordId: dbWord.id }, undefined);
    return { valid: false, error: "A palavra foi marcada como inválida" };
  }

  if (dbWord.isNegative) {
    logger.warn("security", "Blocked word attempted as answer", { word: dbWord.word, wordId: dbWord.id }, undefined);
    return { valid: false, error: "A palavra está bloqueada" };
  }

  logger.debug("word", "Answer word validated successfully", { wordId: dbWord.id, word: dbWord.word });
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
    logger.debug("word", "Invalid attempt word format", { word, error: validation.error });
    return { valid: false, error: validation.error };
  }

  if (validation.normalized && validation.normalized.length !== expectedLength) {
    const error = `A palavra deve ter exatamente ${expectedLength} letras`;
    logger.debug("word", "Attempt word length mismatch", { word, expectedLength, actualLength: validation.normalized.length });
    return { valid: false, error };
  }

  const dbWord = await getWordByNormalized(validation.normalized!);

  if (!dbWord) {
    logger.info("word", "Non-dictionary word attempted", { word: validation.normalized, expectedLength });
    return { valid: false, error: "Palavra não encontrada no dicionário" };
  }

  if (dbWord.isNegative) {
    logger.warn("security", "Blocked word attempted in game", { word: dbWord.word, wordId: dbWord.id }, undefined);
    return { valid: false, error: "A palavra está bloqueada" };
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
