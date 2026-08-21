/**
 * Word Normalization Utilities
 * Centralized logic for normalizing Portuguese words
 */

/**
 * Normalize a Portuguese word for comparison
 * Removes accents and converts to lowercase
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Remove diacritics
    .trim();
}

/**
 * Normalize a word preserving the original form
 * Used for storing both original and normalized versions
 */
export function normalizeWordForStorage(word: string): { original: string; normalized: string } {
  const trimmed = word.trim();
  return {
    original: trimmed,
    normalized: normalizeWord(trimmed),
  };
}

/**
 * The range of word lengths the game accepts, for both room/single-player
 * creation and answer/attempt validation. Single source of truth — every
 * length check in the app (client word-length pickers, createRoom,
 * startSinglePlayerGame, validateWordFormat below) reads from these two
 * constants instead of repeating the bounds, so raising or lowering the
 * range only ever means changing it here.
 */
export const MIN_WORD_LENGTH = 4;
export const MAX_WORD_LENGTH = 10;

/**
 * Validate if a word has valid length for Wordle
 */
export function isValidWordLength(word: string): boolean {
  const length = word.length;
  return length >= MIN_WORD_LENGTH && length <= MAX_WORD_LENGTH;
}

/**
 * Get the length of a word
 */
export function getWordLength(word: string): number {
  return word.trim().length;
}

/**
 * Check if a word contains only Portuguese letters and accents
 */
export function isValidPortugueseWord(word: string): boolean {
  // Portuguese alphabet with accented characters
  const portugueseRegex = /^[a-záàâãäéèêëíìîïóòôõöúùûüçñ]+$/i;
  return portugueseRegex.test(word.trim());
}

/**
 * Normalize and validate a word for use in the game
 */
export function validateWordFormat(word: string): { valid: boolean; error?: string; normalized?: string } {
  const trimmed = word.trim();

  if (!trimmed) {
    return { valid: false, error: "A palavra não pode estar vazia" };
  }

  if (!isValidPortugueseWord(trimmed)) {
    return { valid: false, error: "A palavra contém caracteres inválidos" };
  }

  if (!isValidWordLength(trimmed)) {
    return {
      valid: false,
      error: `A palavra deve ter entre ${MIN_WORD_LENGTH} e ${MAX_WORD_LENGTH} letras. Atual: ${trimmed.length}`,
    };
  }

  return {
    valid: true,
    normalized: normalizeWord(trimmed),
  };
}

/**
 * Compare two words ignoring case and accents
 */
export function compareNormalizedWords(word1: string, word2: string): boolean {
  return normalizeWord(word1) === normalizeWord(word2);
}

/**
 * Extract character list from a word (with normalized form)
 */
export function getWordCharacters(word: string): { char: string; normalized: string }[] {
  return word.split("").map((char) => ({
    char,
    normalized: normalizeWord(char),
  }));
}

/**
 * Detect if a word has repeated characters
 */
export function hasRepeatedCharacters(word: string): boolean {
  const normalized = normalizeWord(word);
  return new Set(normalized.split("")).size < normalized.length;
}

/**
 * Get character frequency map
 */
export function getCharacterFrequency(word: string): Map<string, number> {
  const normalized = normalizeWord(word);
  const freq = new Map<string, number>();

  for (const char of normalized) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }

  return freq;
}
