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

  test("pictures may come from https sites (preview pictures), but never over plain http", () => {
    const images = csp.split("; ").find((rule) => rule.startsWith("img-src"));
    expect(images).toBe("img-src 'self' data: blob: https:");
    expect(images).not.toContain("http:");
    // Allowing pictures allows nothing else: everything else stays on 'self'.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
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
