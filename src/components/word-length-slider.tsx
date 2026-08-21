"use client";

import { MAX_WORD_LENGTH, MIN_WORD_LENGTH } from "@/lib/word-normalization";

/**
 * A rough difficulty label per word length, purely cosmetic — the actual
 * gameplay rule is just "longer word, more letters to place," this just
 * gives the slider's current value some context instead of a bare number.
 */
const DIFFICULTY_LABELS: Record<number, string> = {
  4: "Fácil",
  5: "Normal",
  6: "Difícil",
  7: "Muito Difícil",
  8: "Especialista",
  9: "Mestre",
  10: "Extremo",
};

const PLAYABLE_LENGTHS = Array.from(
  { length: MAX_WORD_LENGTH - MIN_WORD_LENGTH + 1 },
  (_, i) => MIN_WORD_LENGTH + i,
);

/**
 * Word-length picker shared by room creation and single-player start.
 * A slider instead of one button per length: a button grid stopped
 * scaling once the range grew past 4-6 (see MIN_WORD_LENGTH/
 * MAX_WORD_LENGTH in src/lib/word-normalization.ts) — seven buttons
 * either wrap awkwardly or shrink too small to tap comfortably on a
 * phone, where a single draggable thumb keeps working regardless of how
 * wide the range is.
 */
export function WordLengthSlider({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
          {value}
        </span>
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {DIFFICULTY_LABELS[value] ?? `${value} letras`}
        </span>
      </div>

      <input
        type="range"
        min={MIN_WORD_LENGTH}
        max={MAX_WORD_LENGTH}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        aria-label="Tamanho da palavra"
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="flex justify-between mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        {PLAYABLE_LENGTHS.map((length) => (
          <span
            key={length}
            className={
              length === value
                ? "font-bold text-blue-600 dark:text-blue-400"
                : ""
            }
          >
            {length}
          </span>
        ))}
      </div>
    </div>
  );
}
