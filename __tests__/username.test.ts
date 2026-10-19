import { describe, expect, test } from "vitest";
import { normalizeUsername, RESERVED_USERNAMES, usernameError } from "@/lib/username";

describe("normalizeUsername", () => {
  test("trims, drops a leading @ and lowercases", () => {
    expect(normalizeUsername("  @Borhan ")).toBe("borhan");
  });
});

describe("usernameError", () => {
  test("accepts letters, numbers and _", () => {
    expect(usernameError("borhan_2000")).toBeNull();
  });

  test("needs 3 to 20 characters", () => {
    expect(usernameError("ab")).toBe("Usernames need at least 3 characters.");
    expect(usernameError("a".repeat(21))).toBe("Usernames can have at most 20 characters.");
    expect(usernameError("a".repeat(20))).toBeNull();
  });

  test("refuses other characters", () => {
    expect(usernameError("bor han")).toBe("Use only letters, numbers and _.");
    expect(usernameError("borhan.r")).toBe("Use only letters, numbers and _.");
    expect(usernameError("borhän")).toBe("Use only letters, numbers and _.");
  });

  test("refuses reserved names", () => {
    expect(RESERVED_USERNAMES).toContain("account");
    expect(usernameError("account")).toBe("@account is reserved. Please choose another.");
  });
});
