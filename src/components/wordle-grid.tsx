"use client";

import { useMemo } from "react";
import type { AttemptLetterResult } from "@/types";

interface WordleGridProps {
  wordLength: number;
  attempts: Array<{ attemptText: string; result: AttemptLetterResult[] }>;
  currentAttempt?: string;
  maxAttempts?: number;
}

export function WordleGrid({
  wordLength,
  attempts,
  currentAttempt = "",
  maxAttempts = 6,
}: WordleGridProps) {
  // Build grid data
  const gridData = useMemo(() => {
    const grid: Array<{
      char: string;
      status: "correct" | "present" | "absent" | "empty";
    }[]> = [];

    // Add completed attempts
    for (const attempt of attempts) {
      const row = attempt.result.map((r) => ({
        char: r.letter.toUpperCase(),
        status: r.status.toLowerCase() as "correct" | "present" | "absent",
      }));
      grid.push(row);
    }

    // Add current attempt row
    if (currentAttempt) {
      const row = currentAttempt.split("").map((char) => ({
        char: char.toUpperCase(),
        status: "empty" as const,
      }));

      // Pad with empty tiles
      while (row.length < wordLength) {
        row.push({ char: "", status: "empty" as const });
      }

      grid.push(row);
    }

    // Add empty rows
    while (grid.length < maxAttempts) {
      grid.push(
        Array.from({ length: wordLength }, () => ({
          char: "",
          status: "empty" as const,
        }))
      );
    }

    return grid;
  }, [wordLength, attempts, currentAttempt, maxAttempts]);

  return (
    // Tiles are sized by flex-1 (share of the row's own width) instead of a
    // fixed px width: with a fixed size, a 6-letter grid plus its gaps
    // doesn't fit inside a narrow phone's viewport (e.g. 6 * 56px + 5 * 8px
    // = 376px, wider than a 360px screen minus the page's own padding) and
    // overflows horizontally. The max-width is capped tighter on mobile
    // (240px vs. the desktop 320px/max-w-xs) so tiles — and therefore the
    // whole grid's height, since each tile is aspect-square — stay small
    // enough that a 6-attempt board still fits above the keyboard without
    // scrolling on a phone screen. min-w-0 stops flex's default
    // content-based minimum width from fighting the shrink on the
    // narrowest phones.
    <div className="flex flex-col gap-1 sm:gap-2 w-full max-w-[240px] sm:max-w-xs mx-auto">
      {gridData.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-1 sm:gap-2">
          {row.map((tile, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`
                wordle-tile flex-1 min-w-0
                ${tile.status === "correct" ? "wordle-tile correct" : ""}
                ${tile.status === "present" ? "wordle-tile present" : ""}
                ${tile.status === "absent" ? "wordle-tile absent" : ""}
                ${tile.status === "empty" ? "wordle-tile empty" : ""}
                transition-all duration-300
                ${rowIndex < attempts.length ? "animate-flip" : ""}
              `}
            >
              {tile.char}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
