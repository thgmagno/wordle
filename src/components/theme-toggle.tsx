"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

/**
 * Manual light/dark switch. `next-themes` (wired up in providers.tsx) makes
 * dark mode follow the OS by default, but CLAUDE.md's section 29 explicitly
 * requires the user be able to choose and persist an explicit preference —
 * without a control like this one, there's no way to override the system
 * setting, and "persistência da preferência" has nothing to persist.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // resolvedTheme is undefined on the server and for one tick on the
  // client (next-themes reads localStorage/matchMedia after mount) — a
  // fixed-size placeholder avoids a hydration mismatch and layout shift.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-9 h-9 shrink-0" aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
    >
      <span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
}
