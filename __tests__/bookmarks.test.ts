import { describe, expect, test } from "vitest";
import { escapeHtml, toBookmarksHtml } from "@/lib/bookmarks";

const link = { id: "1", url: "https://example.com/a", title: "Example", tags: [], createdAt: "2020-01-01T00:00:00.000Z" };

describe("escapeHtml", () => {
  test("escapes the characters that would break HTML", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;");
  });
});

describe("toBookmarksHtml", () => {
  test("starts with the header browsers look for", () => {
    expect(toBookmarksHtml([], []).startsWith("<!DOCTYPE NETSCAPE-Bookmark-file-1>")).toBe(true);
  });

  test("writes each link with its address, title and saved date", () => {
    const html = toBookmarksHtml([link], []);

    // ADD_DATE is in seconds since 1970, like browsers write it.
    expect(html).toContain('<DT><A HREF="https://example.com/a" ADD_DATE="1577836800">Example</A>');
  });

  test("uses the domain when a link has no title", () => {
    expect(toBookmarksHtml([{ ...link, title: undefined }], [])).toContain(">example.com</A>");
  });

  test("keeps tags", () => {
    expect(toBookmarksHtml([{ ...link, tags: ["react", "docs"] }], [])).toContain('TAGS="react,docs"');
  });

  test("puts links inside their folder", () => {
    const html = toBookmarksHtml([{ ...link, folderId: "f1" }], [{ id: "f1", name: "Work" }]);

    expect(html).toMatch(/<DT><H3>Work<\/H3>\s*<DL><p>\s*<DT><A HREF="https:\/\/example.com\/a"/);
  });

  test("keeps empty folders", () => {
    expect(toBookmarksHtml([], [{ id: "f1", name: "Empty" }])).toContain("<DT><H3>Empty</H3>");
  });

  test("escapes titles, so a page title can't add its own HTML", () => {
    const html = toBookmarksHtml([{ ...link, title: '<script>alert("hi")</script>' }], []);

    expect(html).toContain("&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
