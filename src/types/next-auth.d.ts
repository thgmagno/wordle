import type { DefaultSession } from "next-auth";

/**
 * Extends Auth.js's default types with the two fields every Server
 * Action in this app actually relies on: `session.user.id` (used
 * everywhere as the authoritative acting user — never a client-supplied
 * id) and `session.user.isGuest` (used to keep a name-only "Entrar sem
 * conta" identity, see src/lib/auth.ts, out of the global ranking even
 * if a Server Action is called directly with a forged payload).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isGuest: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    isGuest?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isGuest?: boolean;
  }
}
