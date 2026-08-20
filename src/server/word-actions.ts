"use server";

import { validateAnswerWord, validateAttemptWord } from "./word-service";

export async function validateAnswerWordAction(word: string, expectedLength: number) {
  return validateAnswerWord(word, expectedLength);
}

export async function validateAttemptWordAction(word: string, expectedLength: number) {
  return validateAttemptWord(word, expectedLength);
}
