"use client";

import { useEffect, useMemo } from "react";
import type { AttemptLetterResult } from "@/types";

const KEYBOARD_ROWS = [
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  "zxcvbnm".split(""),
];

interface WordleKeyboardProps {
  onKeyPress: (key: string) => void;
  attempts: Array<{ attemptText: string; result: AttemptLetterResult[] }>;
  disabled?: boolean;
  wordLength?: number;
}

export function WordleKeyboard({
  onKeyPress,
  attempts,
  disabled = false,
  wordLength = 5,
}: WordleKeyboardProps) {
  // Build keyboard state
  const keyboardState = useMemo(() => {
    const state = new Map<string, "correct" | "present" | "absent">();
    const statusRank = { correct: 3, present: 2, absent: 1 };

    for (const { result } of attempts) {
      for (const { letter, status } of result) {
        const normalizedLetter = letter.toLowerCase();
        // A letter not yet in the map has no rank at all — NOT the same
        // as already being recorded "absent". Defaulting the missing case
        // to rank 1 (absent's own rank) meant a letter whose only
        // occurrence so far was ABSENT could never pass `newRank >
        // currentRank` (1 > 1 is false), so it was silently never added to
        // the map — leaving keys for genuinely-guessed-and-wrong letters
        // looking identical to never-guessed ones on the keyboard.
        const currentRank = state.has(normalizedLetter)
          ? statusRank[state.get(normalizedLetter) as "correct" | "present" | "absent"]
          : 0;
        const newRank = statusRank[status.toLowerCase() as "correct" | "present" | "absent"];

        if (newRank > currentRank) {
          state.set(normalizedLetter, status.toLowerCase() as "correct" | "present" | "absent");
        }
      }
    }

    return state;
  }, [attempts]);

  // Handle physical keyboard
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;

      const key = event.key.toLowerCase();

      if (/^[a-z]$/.test(key)) {
        event.preventDefault();
        onKeyPress(key);
      } else if (key === "enter") {
        event.preventDefault();
        onKeyPress("enter");
      } else if (key === "backspace") {
        event.preventDefault();
        onKeyPress("backspace");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onKeyPress, disabled]);

  const getKeyClass = (key: string) => {
    const status = keyboardState.get(key);
    let classes = "keyboard-key";

    if (status) {
      classes += ` ${status}`;
    }

    return classes;
  };

  return (
    // Every key gets the SAME size — a clamp() between a floor and a
    // ceiling, scaled by viewport width — regardless of which row it's
    // in. Sizing keys with flex-1 (a share of their own row's width)
    // looks right for the top row but makes the shorter rows' keys
    // visibly *wider* than the top row's, since flex-1 divides each row's
    // width by only that row's own key count (10 in the top row, 9 in the
    // middle, 8 in the bottom with backspace) instead of a shared size.
    // flex-none plus justify-center on each row reproduces the classic
    // Wordle keyboard look instead: identical key size everywhere, and
    // shorter rows just end up centered.
    <div className="flex flex-col gap-1 sm:gap-1.5 w-full max-w-2xl mx-auto px-1 sm:px-2">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1 sm:gap-1.5 justify-center">
          {row.map((key) => (
            <button
              key={key}
              onClick={() => onKeyPress(key)}
              disabled={disabled}
              className={`${getKeyClass(key)} flex-none w-[clamp(1.75rem,8.5vw,2.75rem)] h-9 sm:h-12 px-0 flex items-center justify-center`}
            >
              {key.toUpperCase()}
            </button>
          ))}

          {rowIndex === KEYBOARD_ROWS.length - 1 && (
            <button
              onClick={() => onKeyPress("backspace")}
              disabled={disabled}
              aria-label="Apagar letra"
              className="keyboard-key flex-none w-[clamp(2.75rem,13vw,4rem)] h-9 sm:h-12 px-0 flex items-center justify-center"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
