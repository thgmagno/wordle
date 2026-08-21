/**
 * Validation for the name a guest ("Entrar sem conta") types in on the
 * sign-in screen — the only input that flow collects. Centralized here
 * instead of inline in the Credentials provider's `authorize()` (see
 * src/lib/auth.ts) so it's independently testable and has exactly one
 * definition of what counts as a valid guest name.
 */

const MIN_LENGTH = 1;
const MAX_LENGTH = 30;

// Letters (including accented, per \p{L}) and combining marks (\p{M}, for
// scripts that compose diacritics as separate code points), plus spaces,
// apostrophes and hyphens for names like "Ana-Maria" or "D'Angelo».
// Deliberately excludes digits, emoji, and punctuation/markup-like
// characters — a guest name is displayed as-is next to a player's
// attempts/hints, so keeping it to plausible real-name characters avoids
// visual noise, not because rendering it is otherwise unsafe (React
// escapes it either way).
const VALID_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'-]*$/u;

export function validateGuestName(input: unknown): {
  valid: boolean;
  error?: string;
  name?: string;
} {
  if (typeof input !== "string") {
    return { valid: false, error: "Informe um nome" };
  }

  // Collapse internal runs of whitespace (e.g. accidental double spaces
  // from a mobile keyboard) in addition to trimming the ends.
  const trimmed = input.trim().replace(/\s+/g, " ");

  if (trimmed.length < MIN_LENGTH) {
    return { valid: false, error: "Informe um nome" };
  }

  if (trimmed.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `O nome deve ter no máximo ${MAX_LENGTH} caracteres`,
    };
  }

  if (!VALID_NAME_PATTERN.test(trimmed)) {
    return { valid: false, error: "O nome deve conter apenas letras" };
  }

  return { valid: true, name: trimmed };
}
