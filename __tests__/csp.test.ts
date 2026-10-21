import { describe, expect, test } from "vitest";
import { buildCsp, SECURITY_HEADERS } from "@/lib/csp";

describe("buildCsp", () => {
  const csp = buildCsp("abc123");

  test("only scripts carrying this page's nonce may run", () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  test("never shows Linkwell inside another site, and allows no plugins", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  test("development adds what React needs for its error messages", () => {
    expect(buildCsp("abc123", true)).toContain("'unsafe-eval'");
    expect(buildCsp("abc123", true)).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'nonce-abc123'");
  });
});

test("every response gets the basic security headers", () => {
  const keys = SECURITY_HEADERS.map((header) => header.key);
  expect(keys).toEqual(
    expect.arrayContaining(["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Strict-Transport-Security"])
  );
});
