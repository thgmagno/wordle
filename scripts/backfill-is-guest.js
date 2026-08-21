/**
 * Backfill script: sets `isGuest: false` explicitly on every User document
 * that's missing the field entirely.
 *
 * `User.isGuest` was added to the schema after this app already had real
 * accounts in production. Prisma's `@default(false)` only applies at
 * document-create time — it never retroactively backfills existing MongoDB
 * documents — so any account created before that migration has no
 * `isGuest` field stored at all, not even `false`.
 *
 * That silently breaks every query that filters on `isGuest: false` (or an
 * equivalent negation like `not: true`/`NOT: { isGuest: true }` — verified,
 * none of those match a genuinely missing field on MongoDB through Prisma,
 * even though a raw `$ne` query would): the global ranking's
 * `getGlobalRanking`/`getUserRankingPosition` (src/server/ranking-actions.ts)
 * require `isGuest: false` to include a user, so a real, non-guest account
 * that predates the field is invisible to the entire leaderboard — it just
 * never shows up, with no error anywhere to point at why.
 *
 * This script is the actual fix for those existing accounts (the app's own
 * query-level filter is already correct for every document going forward —
 * new accounts always get `isGuest: false` written explicitly by Prisma).
 * It's a plain, idempotent `updateMany`: running it again after every
 * affected document has already been fixed is a safe no-op (zero documents
 * will match `{ isGuest: { $exists: false } }` the second time).
 *
 * Uso: npm run migrate:backfill-is-guest
 */

require("dotenv/config");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Corrigindo contas sem o campo isGuest...\n");

  // Prisma's typed filters for a required Boolean field don't expose an
  // "is missing" condition (only equals/not, and — see this script's own
  // header comment — neither reaches a genuinely absent field on Mongo
  // through Prisma either way), so this goes straight to the driver with
  // the raw MongoDB update command instead.
  const result = await prisma.$runCommandRaw({
    update: "User",
    updates: [
      {
        q: { isGuest: { $exists: false } },
        u: { $set: { isGuest: false } },
        multi: true,
      },
    ],
  });

  const matched = result.n ?? 0;
  const modified = result.nModified ?? 0;

  console.log(`Documentos encontrados sem o campo: ${matched}`);
  console.log(`Documentos corrigidos: ${modified}`);

  if (matched === 0) {
    console.log("\n✓ Nenhuma conta pendente — todas já têm o campo isGuest definido.");
  } else {
    console.log("\n✓ Correção concluída. Essas contas agora aparecem corretamente no ranking global (se elegíveis).");
  }
}

main()
  .catch((error) => {
    console.error("Erro ao corrigir contas:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
