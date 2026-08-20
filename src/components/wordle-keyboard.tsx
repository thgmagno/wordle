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
        const currentRank = statusRank[state.get(normalizedLetter) || "absent"];
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
    // Every key is flex-1 within its own row (share of that row's width)
    // instead of a fixed/content-based size: 10 keys plus their gaps
    // otherwise don't reliably fit a narrow phone's viewport and overflow
    // horizontally. Submitting is handled entirely by the standalone
    // "Enviar" button above this keyboard (and the physical Enter key,
    // still bound below) — there's no on-screen Enter key here to keep the
    // letter rows visually consistent with the rest of the row.
    <div className="flex flex-col gap-1.5 w-full max-w-2xl mx-auto px-1 sm:px-2">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1 sm:gap-1.5 justify-center">
          {row.map((key) => (
            <button
              key={key}
              onClick={() => onKeyPress(key)}
              disabled={disabled}
              className={`${getKeyClass(key)} flex-1 min-w-0 max-w-10 sm:max-w-12`}
            >
              {key.toUpperCase()}
            </button>
          ))}

          {rowIndex === KEYBOARD_ROWS.length - 1 && (
            <button
              onClick={() => onKeyPress("backspace")}
              disabled={disabled}
              aria-label="Apagar letra"
              className="keyboard-key flex-[1.5] min-w-0 max-w-16 sm:max-w-20 px-1"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
