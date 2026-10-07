import { describe, expect, test } from "vitest";
import { checkLink } from "@/lib/checkLink";

function respondWith(status: number): typeof fetch {
  return async () => new Response(null, { status });
}

function failWith(name: string, code?: string): typeof fetch {
  return async () => {
    const error = new Error("fetch failed", { cause: { code } });
    error.name = name;
    throw error;
  };
}

describe("checkLink", () => {
  test("is ok when the page loads", async () => {
    expect(await checkLink("https://example.com", respondWith(200))).toBe("ok");
  });

  test("is broken when the page is not found", async () => {
    expect(await checkLink("https://example.com/old", respondWith(404))).toBe("broken");
  });

  test("is broken when the page is gone for good", async () => {
    expect(await checkLink("https://example.com/old", respondWith(410))).toBe("broken");
  });

  test("is ok when the site blocks us or has a temporary problem", async () => {
    expect(await checkLink("https://example.com", respondWith(403))).toBe("ok");
    expect(await checkLink("https://example.com", respondWith(503))).toBe("ok");
  });

  test("is broken when the domain doesn't exist", async () => {
    expect(await checkLink("https://no-such-site.example", failWith("TypeError", "ENOTFOUND"))).toBe("broken");
  });

  test("is broken when nothing answers at that address", async () => {
    expect(await checkLink("https://example.com", failWith("TypeError", "ECONNREFUSED"))).toBe("broken");
  });

  test("is ok when the site answers but fetch can't read the answer", async () => {
    expect(await checkLink("https://gemini.google.com/app", failWith("TypeError", "UND_ERR_HEADERS_OVERFLOW"))).toBe("ok");
    expect(await checkLink("https://example.com", failWith("TypeError", "CERT_HAS_EXPIRED"))).toBe("ok");
  });

  test("is ok when the site is only slow", async () => {
    expect(await checkLink("https://example.com", failWith("TimeoutError"))).toBe("ok");
  });

  test("is broken when the address isn't a web link", async () => {
    expect(await checkLink("ftp://example.com", respondWith(200))).toBe("broken");
    expect(await checkLink("not a url", respondWith(200))).toBe("broken");
  });
});
