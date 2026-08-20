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
    <div className="flex flex-col gap-2">
      {gridData.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-2">
          {row.map((tile, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`
                wordle-tile w-14 h-14 sm:w-16 sm:h-16
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
