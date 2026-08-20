/**
 * Dictionary Import Script
 * Imports Portuguese words from fserb/pt-br repository
 *
 * Usage: npm run dictionary:import
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Portuguese dictionary sources from fserb/pt-br
const DICTIONARY_SOURCES = {
  words: "https://raw.githubusercontent.com/fserb/pt-br/master/words.txt",
  negative: "https://raw.githubusercontent.com/fserb/pt-br/master/bad-words.txt",
};

// Normalize word (remove accents, lowercase)
function normalizeWord(word) {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Download a file from URL
async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve(data);
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

// Parse word list
function parseWordList(content) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

// Main import function
async function importDictionary() {
  console.log("Starting dictionary import...\n");

  try {
    // Download word lists
    console.log("Downloading word lists from fserb/pt-br...");
    const [wordsContent, negativeContent] = await Promise.all([
      downloadFile(DICTIONARY_SOURCES.words),
      downloadFile(DICTIONARY_SOURCES.negative).catch(() => ""), // Negative list is optional
    ]);

    const wordsList = parseWordList(wordsContent);
    const negativeList = parseWordList(negativeContent);
    const negativeSet = new Set(negativeList.map((w) => normalizeWord(w)));

    console.log(`Downloaded ${wordsList.length} words`);
    console.log(`Downloaded ${negativeList.length} negative words\n`);

    // Filter words by valid length (4, 5, 6 letters only)
    const validWords = wordsList.filter((word) => {
      const length = word.length;
      return length === 4 || length === 5 || length === 6;
    });

    console.log(`Found ${validWords.length} words with valid length (4-6 letters)\n`);

    // Clear existing dictionary
    console.log("Clearing existing dictionary...");
    const deletedCount = await prisma.word.deleteMany({});
    console.log(`Deleted ${deletedCount.count} existing words\n`);

    // Import words in batches
    const batchSize = 1000;
    let imported = 0;
    let negative = 0;
    let duplicates = 0;
    const seenWords = new Set();

    console.log("Importing words...");

    for (let i = 0; i < validWords.length; i += batchSize) {
      const batch = validWords.slice(i, i + batchSize);
      const operations = [];

      for (const word of batch) {
        const trimmed = word.trim();
        const normalized = normalizeWord(trimmed);

        // Skip duplicates
        if (seenWords.has(normalized)) {
          duplicates++;
          continue;
        }

        seenWords.add(normalized);

        const isNegative = negativeSet.has(normalized);
        if (isNegative) negative++;

        operations.push(
          prisma.word.upsert({
            where: { normalizedWord: normalized },
            create: {
              word: trimmed,
              normalizedWord: normalized,
              length: trimmed.length,
              isNegative,
              isValid: true,
              origin: "fserb-pt-br",
            },
            update: {
              word: trimmed,
              isNegative,
            },
          })
        );
      }

      await Promise.all(operations);
      imported += operations.length;
      console.log(`  Imported ${imported}/${validWords.length} words...`);
    }

    // Get final statistics
    const stats = await prisma.word.groupBy({
      by: ["length"],
      _count: true,
      where: { isValid: true, isNegative: false },
    });

    console.log("\n✓ Dictionary import complete!\n");
    console.log("Summary:");
    console.log(`  Total imported: ${imported}`);
    console.log(`  Negative words: ${negative}`);
    console.log(`  Duplicates skipped: ${duplicates}`);
    console.log("\nWords by length:");

    for (const group of stats) {
      console.log(`  ${group.length} letters: ${group._count}`);
    }

    const totalStats = await prisma.word.count({
      where: { isValid: true, isNegative: false },
    });

    console.log(`\n  Total valid words: ${totalStats}`);
  } catch (error) {
    console.error("Error importing dictionary:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run import
importDictionary();
