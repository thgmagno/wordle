/**
 * Dictionary Import Script
 * Importa palavras em pt-BR do repositório fserb/pt-br para o MongoDB.
 *
 * Fontes (nomes reais do repo, sem extensão):
 *   - lexico            → léxico principal
 *   - icf               → "palavra,score" (frequência inversa no corpus)
 *   - listas/negativas  → palavras bloqueadas
 *
 * A execução é idempotente: reexecutar não gera duplicatas nem apaga o dicionário.
 *
 * Uso: npm run dictionary:import
 */

require("dotenv/config");

const https = require("node:https");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const BASE_URL = "https://raw.githubusercontent.com/fserb/pt-br/master";
const DICTIONARY_SOURCES = {
  lexico: `${BASE_URL}/lexico`,
  icf: `${BASE_URL}/icf`,
  negativas: `${BASE_URL}/listas/negativas`,
};

const ORIGIN = "fserb-pt-br";
// Matches the gameplay range in src/lib/word-normalization.ts
// (MIN_WORD_LENGTH/MAX_WORD_LENGTH, which is what actually gates room
// creation and answer/attempt validation) — every length imported here is
// playable. Keep the two in sync if either changes.
const MIN_LENGTH = 4;
const MAX_LENGTH = 10;
const BATCH_SIZE = 1000;

// Alfabeto pt-BR (a forma original mantém acentos; hífen/espaço/dígito são rejeitados)
const PT_BR_WORD_REGEX = /^[a-záàâãéêíóôõúüç]+$/;

/** Regra única de normalização: minúsculas, sem diacríticos. */
function normalizeWord(word) {
  return word
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .normalize("NFC");
}

/** Forma original preservada, em NFC, para contagem de letras correta. */
function canonicalForm(word) {
  return word.trim().toLowerCase().normalize("NFC");
}

function download(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const { statusCode, headers } = res;

        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          if (redirectsLeft === 0) {
            reject(new Error(`Muitos redirecionamentos ao baixar ${url}`));
            return;
          }
          resolve(download(headers.location, redirectsLeft - 1));
          return;
        }

        if (statusCode !== 200) {
          res.resume();
          reject(new Error(`Falha ao baixar ${url} (HTTP ${statusCode})`));
          return;
        }

        res.setEncoding("utf8");
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function parseLines(content) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

/** icf: "palavra,score". Mantém o menor score por forma normalizada (mais frequente). */
function parseIcf(content) {
  const scores = new Map();

  for (const line of parseLines(content)) {
    const separator = line.lastIndexOf(",");
    if (separator === -1) continue;

    const normalized = normalizeWord(line.slice(0, separator));
    const score = Number.parseFloat(line.slice(separator + 1));
    if (!normalized || !Number.isFinite(score)) continue;

    const current = scores.get(normalized);
    if (current === undefined || score < current) {
      scores.set(normalized, score);
    }
  }

  return scores;
}

/**
 * Seleciona os candidatos de MIN_LENGTH-MAX_LENGTH letras, deduplicados por forma normalizada.
 * Em colisão (ex.: "saia" vs "saía") vence a palavra mais frequente no corpus.
 */
function buildCandidates(lexicoLines, icfScores, negativeSet) {
  const candidates = new Map();
  let rejectedFormat = 0;
  let rejectedLength = 0;
  let collisions = 0;

  for (const line of lexicoLines) {
    const word = canonicalForm(line);

    if (!PT_BR_WORD_REGEX.test(word)) {
      rejectedFormat++;
      continue;
    }

    const length = [...word].length;
    if (length < MIN_LENGTH || length > MAX_LENGTH) {
      rejectedLength++;
      continue;
    }

    const normalizedWord = normalizeWord(word);
    const icfScore = icfScores.get(normalizedWord) ?? null;
    const entry = {
      word,
      normalizedWord,
      length,
      isNegative: negativeSet.has(normalizedWord),
      icfScore,
      isValid: true,
      origin: ORIGIN,
      category: "lexico",
    };

    const existing = candidates.get(normalizedWord);
    if (!existing) {
      candidates.set(normalizedWord, entry);
      continue;
    }

    collisions++;
    const existingScore = existing.icfScore ?? Number.POSITIVE_INFINITY;
    const newScore = icfScore ?? Number.POSITIVE_INFINITY;
    if (newScore < existingScore) {
      candidates.set(normalizedWord, { ...entry, isNegative: entry.isNegative || existing.isNegative });
    } else if (entry.isNegative) {
      existing.isNegative = true;
    }
  }

  return { candidates, rejectedFormat, rejectedLength, collisions };
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function persist(candidates) {
  const existing = await prisma.word.findMany({
    where: { origin: ORIGIN },
    select: { normalizedWord: true, word: true, isNegative: true, icfScore: true, length: true, isValid: true },
  });

  const existingByNormalized = new Map(existing.map((entry) => [entry.normalizedWord, entry]));

  const toCreate = [];
  const toUpdate = [];
  let unchanged = 0;

  for (const entry of candidates.values()) {
    const current = existingByNormalized.get(entry.normalizedWord);

    if (!current) {
      toCreate.push(entry);
      continue;
    }

    const changed =
      current.word !== entry.word ||
      current.length !== entry.length ||
      current.isNegative !== entry.isNegative ||
      current.isValid !== entry.isValid ||
      current.icfScore !== entry.icfScore;

    if (changed) {
      toUpdate.push(entry);
    } else {
      unchanged++;
    }
  }

  let created = 0;
  for (const batch of chunk(toCreate, BATCH_SIZE)) {
    try {
      const result = await prisma.word.createMany({ data: batch });
      created += result.count;
    } catch {
      // Lote com conflito (execução concorrente): cai para upsert individual.
      for (const entry of batch) {
        await prisma.word.upsert({
          where: { normalizedWord: entry.normalizedWord },
          create: entry,
          update: entry,
        });
        created++;
      }
    }
    process.stdout.write(`\r  Criadas ${created}/${toCreate.length}...`);
  }
  if (toCreate.length) process.stdout.write("\n");

  let updated = 0;
  for (const batch of chunk(toUpdate, 200)) {
    await Promise.all(
      batch.map((entry) =>
        prisma.word.update({
          where: { normalizedWord: entry.normalizedWord },
          data: {
            word: entry.word,
            length: entry.length,
            isNegative: entry.isNegative,
            icfScore: entry.icfScore,
            isValid: entry.isValid,
            category: entry.category,
          },
        }),
      ),
    );
    updated += batch.length;
    process.stdout.write(`\r  Atualizadas ${updated}/${toUpdate.length}...`);
  }
  if (toUpdate.length) process.stdout.write("\n");

  return { created, updated, unchanged };
}

async function importDictionary() {
  console.log("Importando dicionário de fserb/pt-br...\n");

  console.log("Baixando fontes...");
  const [lexicoContent, icfContent, negativasContent] = await Promise.all([
    download(DICTIONARY_SOURCES.lexico),
    download(DICTIONARY_SOURCES.icf),
    download(DICTIONARY_SOURCES.negativas),
  ]);

  const lexicoLines = parseLines(lexicoContent);
  const icfScores = parseIcf(icfContent);
  const negativeList = parseLines(negativasContent);
  const negativeSet = new Set(negativeList.map(normalizeWord));

  console.log(`  léxico:    ${lexicoLines.length.toLocaleString("pt-BR")} entradas`);
  console.log(`  ICF:       ${icfScores.size.toLocaleString("pt-BR")} pontuações`);
  console.log(`  negativas: ${negativeSet.size.toLocaleString("pt-BR")} palavras\n`);

  if (lexicoLines.length < 1000) {
    throw new Error("Léxico baixado parece incompleto — abortando para não corromper o dicionário.");
  }

  const { candidates, rejectedFormat, rejectedLength, collisions } = buildCandidates(
    lexicoLines,
    icfScores,
    negativeSet,
  );

  const negativeCount = [...candidates.values()].filter((entry) => entry.isNegative).length;
  const withIcf = [...candidates.values()].filter((entry) => entry.icfScore !== null).length;

  console.log(`Candidatas de ${MIN_LENGTH}-${MAX_LENGTH} letras: ${candidates.size.toLocaleString("pt-BR")}`);
  console.log(`  descartadas por formato:  ${rejectedFormat.toLocaleString("pt-BR")}`);
  console.log(`  descartadas por tamanho:  ${rejectedLength.toLocaleString("pt-BR")}`);
  console.log(`  colisões de normalização: ${collisions.toLocaleString("pt-BR")}`);
  console.log(`  marcadas como negativas:  ${negativeCount.toLocaleString("pt-BR")}`);
  console.log(`  com pontuação ICF:        ${withIcf.toLocaleString("pt-BR")}\n`);

  console.log("Persistindo no MongoDB...");
  const { created, updated, unchanged } = await persist(candidates);

  const byLength = await prisma.word.groupBy({
    by: ["length"],
    _count: { _all: true },
    where: { isValid: true, isNegative: false },
    orderBy: { length: "asc" },
  });

  const totalPlayable = await prisma.word.count({ where: { isValid: true, isNegative: false } });
  const totalStored = await prisma.word.count();

  console.log("\n✓ Importação concluída\n");
  console.log("Resumo:");
  console.log(`  adicionadas:  ${created.toLocaleString("pt-BR")}`);
  console.log(`  atualizadas:  ${updated.toLocaleString("pt-BR")}`);
  console.log(`  inalteradas:  ${unchanged.toLocaleString("pt-BR")}`);
  console.log(`  bloqueadas:   ${negativeCount.toLocaleString("pt-BR")}`);
  console.log("\nPalavras jogáveis por tamanho:");
  for (const group of byLength) {
    console.log(`  ${group.length} letras: ${group._count._all.toLocaleString("pt-BR")}`);
  }
  console.log(`\n  Total jogável:     ${totalPlayable.toLocaleString("pt-BR")}`);
  console.log(`  Total armazenado:  ${totalStored.toLocaleString("pt-BR")}`);
}

importDictionary()
  .catch((error) => {
    console.error("\nErro ao importar dicionário:", error.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
