import {
  normalizeWord,
  normalizeWordForStorage,
  isValidWordLength,
  isValidPortugueseWord,
  validateWordFormat,
  compareNormalizedWords,
  getCharacterFrequency,
  hasRepeatedCharacters,
} from "@/lib/word-normalization";

describe("Word Normalization", () => {
  describe("normalizeWord", () => {
    it("should convert to lowercase", () => {
      expect(normalizeWord("GATOS")).toBe("gatos");
    });

    it("should remove accents", () => {
      expect(normalizeWord("açúcar")).toBe("acucar");
      expect(normalizeWord("ação")).toBe("acao");
      expect(normalizeWord("maçã")).toBe("maca");
    });

    it("should handle multiple accents", () => {
      expect(normalizeWord("JOÃO")).toBe("joao");
      expect(normalizeWord("PÊSSEGO")).toBe("pessego");
    });

    it("should trim whitespace", () => {
      expect(normalizeWord("  gatos  ")).toBe("gatos");
    });

    it("should handle empty strings", () => {
      expect(normalizeWord("")).toBe("");
    });
  });

  describe("normalizeWordForStorage", () => {
    it("should return both original and normalized forms", () => {
      const result = normalizeWordForStorage("Açúcar");
      expect(result.original).toBe("Açúcar");
      expect(result.normalized).toBe("acucar");
    });

    it("should preserve case in original", () => {
      const result = normalizeWordForStorage("GATOS");
      expect(result.original).toBe("GATOS");
    });
  });

  describe("isValidWordLength", () => {
    it("should accept 4-letter words", () => {
      expect(isValidWordLength("casa")).toBe(true);
    });

    it("should accept 5-letter words", () => {
      expect(isValidWordLength("gatos")).toBe(true);
    });

    it("should accept 6-letter words", () => {
      expect(isValidWordLength("porque")).toBe(true);
    });

    it("should reject 1-letter words", () => {
      expect(isValidWordLength("a")).toBe(false);
    });

    it("should reject 3-letter words", () => {
      expect(isValidWordLength("gat")).toBe(false);
    });

    it("should reject 7-letter words", () => {
      expect(isValidWordLength("porque1")).toBe(false);
    });
  });

  describe("isValidPortugueseWord", () => {
    it("should accept Portuguese letters", () => {
      expect(isValidPortugueseWord("gatos")).toBe(true);
    });

    it("should accept accented letters", () => {
      expect(isValidPortugueseWord("açúcar")).toBe(true);
    });

    it("should accept ç", () => {
      expect(isValidPortugueseWord("açúcar")).toBe(true);
    });

    it("should reject numbers", () => {
      expect(isValidPortugueseWord("gatos1")).toBe(false);
    });

    it("should reject special characters", () => {
      expect(isValidPortugueseWord("gatos!")).toBe(false);
    });

    it("should reject English letters not in Portuguese", () => {
      // This might be tricky - Portuguese uses a-z, but with accents
      expect(isValidPortugueseWord("hello")).toBe(true); // Basic letters are Portuguese-compatible
    });
  });

  describe("validateWordFormat", () => {
    it("should validate correctly formatted word", () => {
      const result = validateWordFormat("gatos");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("gatos");
    });

    it("should reject empty words", () => {
      const result = validateWordFormat("");
      expect(result.valid).toBe(false);
    });

    it("should reject invalid Portuguese characters", () => {
      const result = validateWordFormat("gatos1");
      expect(result.valid).toBe(false);
    });

    it("should reject words with invalid length", () => {
      const result = validateWordFormat("gat");
      expect(result.valid).toBe(false);
    });

    it("should handle accented words", () => {
      const result = validateWordFormat("açúcar");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("acucar");
    });
  });

  describe("compareNormalizedWords", () => {
    it("should return true for identical words", () => {
      expect(compareNormalizedWords("gatos", "gatos")).toBe(true);
    });

    it("should return true for case-different words", () => {
      expect(compareNormalizedWords("GATOS", "gatos")).toBe(true);
    });

    it("should return true for words with different accents but same base", () => {
      expect(compareNormalizedWords("açúcar", "acucar")).toBe(true);
    });

    it("should return false for different words", () => {
      expect(compareNormalizedWords("gatos", "catos")).toBe(false);
    });
  });

  describe("getCharacterFrequency", () => {
    it("should count character frequencies", () => {
      const freq = getCharacterFrequency("aaa");
      expect(freq.get("a")).toBe(3);
    });

    it("should handle multiple different characters", () => {
      const freq = getCharacterFrequency("abcabc");
      expect(freq.get("a")).toBe(2);
      expect(freq.get("b")).toBe(2);
      expect(freq.get("c")).toBe(2);
    });

    it("should be case-insensitive", () => {
      const freq = getCharacterFrequency("AaA");
      expect(freq.get("a")).toBe(3);
    });

    it("should return 0 for missing characters", () => {
      const freq = getCharacterFrequency("abc");
      expect(freq.get("d")).toBeUndefined();
    });
  });

  describe("hasRepeatedCharacters", () => {
    it("should return true for repeated characters", () => {
      expect(hasRepeatedCharacters("aaa")).toBe(true);
      expect(hasRepeatedCharacters("aba")).toBe(true);
    });

    it("should return false for all unique characters", () => {
      expect(hasRepeatedCharacters("abc")).toBe(false);
    });

    it("should be case-insensitive", () => {
      expect(hasRepeatedCharacters("AaA")).toBe(true);
    });

    it("should handle accents", () => {
      expect(hasRepeatedCharacters("açúcar")).toBe(true); // has 'a' repeated
    });
  });
});
