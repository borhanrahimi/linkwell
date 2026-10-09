import { describe, expect, test } from "vitest";
import { fetchTitle, readTitle } from "@/lib/fetchTitle";

function respondWith(body: string, status = 200, type = "text/html; charset=utf-8"): typeof fetch {
  return async () => new Response(body, { status, headers: { "content-type": type } });
}

describe("readTitle", () => {
  test("reads the page title", () => {
    expect(readTitle("<html><head><title>Next.js Docs</title></head></html>")).toBe("Next.js Docs");
  });

  test("tidies spaces, line breaks and HTML codes like &amp;", () => {
    expect(readTitle("<title>\n  Tom &amp; Jerry   &#39;s page\n</title>")).toBe("Tom & Jerry 's page");
  });

  test("finds a title tag with attributes, in any case", () => {
    expect(readTitle('<TITLE data-x="1">Hello</TITLE>')).toBe("Hello");
  });

  test("returns nothing when there is no title or it is empty", () => {
    expect(readTitle("<html><body>Hi</body></html>")).toBeUndefined();
    expect(readTitle("<title>   </title>")).toBeUndefined();
  });

  test("cuts very long titles to 200 characters", () => {
    expect(readTitle(`<title>${"a".repeat(500)}</title>`)).toHaveLength(200);
  });
});

describe("fetchTitle", () => {
  test("returns the title of a web page", async () => {
    expect(await fetchTitle("https://example.com", respondWith("<title>Example</title>"))).toBe("Example");
  });

  test("returns nothing when the page is missing", async () => {
    expect(await fetchTitle("https://example.com", respondWith("<title>Not found</title>", 404))).toBeUndefined();
  });

  test("returns nothing for files that aren't web pages", async () => {
    expect(await fetchTitle("https://example.com/a.pdf", respondWith("%PDF", 200, "application/pdf"))).toBeUndefined();
  });

  test("returns nothing when the site can't be reached", async () => {
    const failing: typeof fetch = async () => {
      throw new Error("fetch failed");
    };

    expect(await fetchTitle("https://example.com", failing)).toBeUndefined();
  });

  test("returns nothing for addresses that aren't web links", async () => {
    expect(await fetchTitle("ftp://example.com", respondWith("<title>Hi</title>"))).toBeUndefined();
  });
});
