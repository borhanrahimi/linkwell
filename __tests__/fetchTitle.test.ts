import { describe, expect, test } from "vitest";
import { fetchTitle, readOembedUrl, readTitle } from "@/lib/fetchTitle";
import { BlockedUrlError } from "@/lib/safeUrl";

function respondWith(
  body: string,
  status = 200,
  type = "text/html; charset=utf-8"
): typeof fetch {
  return async () =>
    new Response(body, { status, headers: { "content-type": type } });
}

describe("readTitle", () => {
  test("reads the page title", () => {
    expect(
      readTitle("<html><head><title>Next.js Docs</title></head></html>")
    ).toBe("Next.js Docs");
  });

  test("tidies spaces, line breaks and HTML codes like &amp;", () => {
    expect(
      readTitle("<title>\n  Tom &amp; Jerry   &#39;s page\n</title>")
    ).toBe("Tom & Jerry 's page");
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

  test("prefers the sharing title, which has no site name on the end", () => {
    expect(
      readTitle(
        '<title>Black &amp; Blue - Videos</title><meta content="Black &amp; Blue" property="og:title">'
      )
    ).toBe("Black & Blue");
    expect(readTitle("<meta name='twitter:title' content='Hi'><title>Hi - Site</title>")).toBe("Hi");
  });

  test("skips titles that are only the site's name, like ' - Videos'", () => {
    expect(readTitle("<title> - Videos</title>")).toBeUndefined();
    expect(readTitle('<meta property="og:title" content="| News"><title>Real one</title>')).toBe("Real one");
  });
});

describe("readOembedUrl", () => {
  test("finds the page's title service, resolving relative addresses", () => {
    expect(
      readOembedUrl(
        '<link rel="alternate" type="application/json+oembed" href="/oembed?a=1&amp;b=2">',
        "https://example.com/watch"
      )
    ).toBe("https://example.com/oembed?a=1&b=2");
    expect(readOembedUrl("<link rel='icon' href='/x.png'>", "https://example.com")).toBeUndefined();
  });
});

describe("fetchTitle", () => {
  test("returns the title of a web page", async () => {
    expect(
      await fetchTitle(
        "https://example.com",
        respondWith("<title>Example</title>")
      )
    ).toBe("Example");
  });

  test("returns nothing when the page is missing", async () => {
    expect(
      await fetchTitle(
        "https://example.com",
        respondWith("<title>Not found</title>", 404)
      )
    ).toBeUndefined();
  });

  test("returns nothing for files that aren't web pages", async () => {
    expect(
      await fetchTitle(
        "https://example.com/a.pdf",
        respondWith("%PDF", 200, "application/pdf")
      )
    ).toBeUndefined();
  });

  test("returns nothing when the site can't be reached", async () => {
    const failing: typeof fetch = async () => {
      throw new Error("fetch failed");
    };

    expect(await fetchTitle("https://example.com", failing)).toBeUndefined();
  });

  test("returns nothing for addresses that aren't web links", async () => {
    expect(
      await fetchTitle("ftp://example.com", respondWith("<title>Hi</title>"))
    ).toBeUndefined();
  });
  test("returns nothing when the link points to a private address", async () => {
    const blocked: typeof fetch = async () => {
      throw new BlockedUrlError(
        "http://localhost",
        "it points to a private address"
      );
    };

    expect(await fetchTitle("http://localhost", blocked)).toBeUndefined();
  });

  test("asks a video site's title service first, and returns its title", async () => {
    const asked: string[] = [];
    const fetchFn: typeof fetch = async (input) => {
      asked.push(String(input));
      return new Response(JSON.stringify({ title: "Black & Blue" }), {
        headers: { "content-type": "application/json" },
      });
    };

    expect(await fetchTitle("https://www.youtube.com/watch?v=abc", fetchFn)).toBe("Black & Blue");
    expect(asked).toEqual([
      "https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc",
    ]);
  });

  test("reads the page when the title service doesn't answer", async () => {
    const fetchFn: typeof fetch = async (input) =>
      String(input).includes("oembed")
        ? new Response("busy", { status: 503 })
        : new Response("<title>From the page - Videos</title>", { headers: { "content-type": "text/html" } });

    expect(await fetchTitle("https://youtu.be/abc", fetchFn)).toBe("From the page - Videos");
  });

  test("asks the title service a page names when the page's own title is useless", async () => {
    const fetchFn: typeof fetch = async (input) =>
      String(input) === "https://example.com/oembed"
        ? new Response('{"title":"The real title"}', { headers: { "content-type": "application/json" } })
        : new Response(
            '<title> - Example</title><link rel="alternate" type="application/json+oembed" href="/oembed">',
            { headers: { "content-type": "text/html" } }
          );

    expect(await fetchTitle("https://example.com/page", fetchFn)).toBe("The real title");
  });
});
