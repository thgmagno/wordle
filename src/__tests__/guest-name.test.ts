import { validateGuestName } from "@/lib/guest-name";

describe("validateGuestName", () => {
  it("accepts a plain name", () => {
    const result = validateGuestName("Maria");
    expect(result.valid).toBe(true);
    expect(result.name).toBe("Maria");
  });

  it("accepts accented names", () => {
    const result = validateGuestName("João");
    expect(result.valid).toBe(true);
    expect(result.name).toBe("João");
  });

  it("accepts names with spaces, hyphens and apostrophes", () => {
    expect(validateGuestName("Ana Maria").valid).toBe(true);
    expect(validateGuestName("Ana-Maria").valid).toBe(true);
    expect(validateGuestName("D'Angelo").valid).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const result = validateGuestName("  Maria  ");
    expect(result.valid).toBe(true);
    expect(result.name).toBe("Maria");
  });

  it("collapses internal double spaces", () => {
    const result = validateGuestName("Ana   Maria");
    expect(result.valid).toBe(true);
    expect(result.name).toBe("Ana Maria");
  });

  it("rejects an empty name", () => {
    expect(validateGuestName("").valid).toBe(false);
    expect(validateGuestName("   ").valid).toBe(false);
  });

  it("rejects a non-string input", () => {
    expect(validateGuestName(undefined).valid).toBe(false);
    expect(validateGuestName(null).valid).toBe(false);
    expect(validateGuestName(42).valid).toBe(false);
  });

  it("rejects a name over 30 characters", () => {
    const result = validateGuestName("a".repeat(31));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/30 caracteres/);
  });

  it("accepts a name at exactly the 30-character limit", () => {
    expect(validateGuestName("a".repeat(30)).valid).toBe(true);
  });

  it("rejects digits", () => {
    expect(validateGuestName("Player1").valid).toBe(false);
  });

  it("rejects symbols and markup-like input", () => {
    expect(validateGuestName("<script>alert(1)</script>").valid).toBe(false);
    expect(validateGuestName("Maria!").valid).toBe(false);
    expect(validateGuestName("@Maria").valid).toBe(false);
  });

  it("rejects a name that is only whitespace/punctuation with no letters", () => {
    expect(validateGuestName("---").valid).toBe(false);
  });
});
