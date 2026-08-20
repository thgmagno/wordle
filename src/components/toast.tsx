"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type: "error" | "success";
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Fixed-position, auto-dismissing message — used instead of an inline
 * banner for the game board's error/success feedback. An inline banner
 * pushes the grid/keyboard down and, on a 6-letter game especially, was
 * exactly what forced the board off the bottom of a phone screen. A toast
 * floats above the page instead, so it never affects layout height.
 */
export function Toast({
  message,
  type,
  onDismiss,
  durationMs = 3000,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-center ${
        type === "error" ? "bg-red-600 text-white" : "bg-green-600 text-white"
      }`}
    >
      {message}
    </div>
  );
}
