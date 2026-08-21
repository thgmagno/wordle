import { randomUUID } from "node:crypto";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { validateGuestName } from "./guest-name";
import { logger } from "./logger";
import { prisma } from "./prisma";
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "./rate-limit";

const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // "Entrar sem conta" — for someone without a usable Google account
    // (e.g. a child whose account is under Family Link and can't finish
    // Google sign-in themselves). Only a display name is collected; a
    // fresh, name-only User row is created on every login (see the
    // isGuest field's comment on the schema) and the guest is force-kept
    // out of the global ranking, both here and defensively again in
    // updateLeaderboardVisibility.
    //
    // The Credentials provider only persists a user via the adapter for
    // OAuth flows — for credentials it's on `authorize()` to do that
    // itself — and, per Auth.js's own constraint, only works when the
    // session strategy is "jwt" (below), not the "database" strategy the
    // Google provider used before this. The adapter is kept for Google
    // (Account linking still needs it); Google's sessions simply move
    // from a Session table row to a signed JWT cookie, which changes
    // nothing any Server Action observes — they all just read
    // session.user.id via auth().
    Credentials({
      id: "guest",
      name: "Convidado",
      credentials: {
        name: { label: "Nome", type: "text" },
      },
      async authorize(credentials) {
        const rateLimit = await checkRateLimit(
          "guest-login",
          RATE_LIMIT_CONFIGS.GUEST_LOGIN,
        );
        if (!rateLimit.allowed) {
          logger.warn(
            "security",
            "Guest login rate limit exceeded",
            {},
            undefined,
          );
          return null;
        }

        const validation = validateGuestName(credentials?.name);
        if (!validation.valid || !validation.name) {
          return null;
        }

        // User.email is unique, and — this is a MongoDB-specific trap, not
        // a Prisma schema mistake — a non-sparse unique index on an
        // OPTIONAL field still enforces uniqueness across documents that
        // simply omit it: MongoDB treats "field missing" as one shared
        // null-ish value for indexing purposes, so a second guest.create()
        // with no `email` at all would fail with a duplicate-key error the
        // moment a first one already existed. A random, guaranteed-unique
        // placeholder on the reserved-for-exactly-this `.invalid` TLD
        // (RFC 2606 — never a real, resolvable domain, so it can never
        // collide with an actual Google account's email) sidesteps that.
        // It never reaches the client: `authorize()`'s return value (not
        // this DB row) is what Auth.js encodes into the token/session, and
        // that return value below deliberately omits `email`.
        const user = await prisma.user.create({
          data: {
            name: validation.name,
            email: `guest-${randomUUID()}@guest.invalid`,
            isGuest: true,
            showInLeaderboard: false,
          },
        });

        logger.info(
          "security",
          "Guest user created",
          { userId: user.id },
          user.id,
        );

        return { id: user.id, name: user.name, isGuest: true };
      },
    }),
  ],
  // The Credentials provider above can only work with JWT-based sessions
  // (Auth.js doesn't persist a Session row for it — see its own docs) —
  // an adapter alone defaults NextAuth to the "database" strategy, so
  // this has to be set explicitly even though Google sign-in doesn't
  // strictly need it. Google's User/Account rows are still persisted via
  // the adapter either way; only where the session itself lives changes.
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    // Runs on every request; `user` is only defined on the request that
    // just signed in (the adapter-persisted user for Google, or whatever
    // `authorize()` returned for a guest) — that's the one moment to copy
    // its id/isGuest into the long-lived token.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isGuest = user.isGuest ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isGuest = Boolean(token.isGuest);
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAuthPage = nextUrl.pathname.startsWith("/auth");

      if (isOnAuthPage) {
        return !isLoggedIn;
      }

      return isLoggedIn;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
