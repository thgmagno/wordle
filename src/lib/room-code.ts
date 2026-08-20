/**
 * Short, human-typeable room codes (e.g. "7K3PQR") — the Room model's
 * public identifier, used in the shareable URL and shown in the lobby
 * instead of the raw MongoDB ObjectId (a 24-character hex string with no
 * vowels or separators, effectively impossible to read aloud, memorize, or
 * type correctly).
 */

// Excludes visually ambiguous characters (0/O, 1/I/L) so a code read aloud
// or handwritten is never misheard/miswritten into a different valid code.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/**
 * Normalizes user-provided room code input (typed into a URL, the "join by
 * code" prompt, etc.) to the canonical stored form — uppercase, no
 * surrounding whitespace — so lookups are never case- or whitespace-
 * sensitive.
 */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}
