import { describe, expect, test } from "vitest";
import {
  cleanBookmark,
  escapeHtml,
  parseBookmarksHtml,
  toBookmarksHtml,
} from "@/lib/bookmarks";

const link = {
  id: "1",
  url: "https://example.com/a",
  title: "Example",
  tags: [],
  createdAt: "2020-01-01T00:00:00.000Z",
};

describe("escapeHtml", () => {
  test("escapes the characters that would break HTML", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe(
      "&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;"
    );
  });
});

describe("toBookmarksHtml", () => {
  test("starts with the header browsers look for", () => {
    expect(
      toBookmarksHtml([], []).startsWith("<!DOCTYPE NETSCAPE-Bookmark-file-1>")
    ).toBe(true);
  });

  test("writes each link with its address, title and saved date", () => {
    const html = toBookmarksHtml([link], []);

    // ADD_DATE is in seconds since 1970, like browsers write it.
    expect(html).toContain(
      '<DT><A HREF="https://example.com/a" ADD_DATE="1577836800">Example</A>'
    );
  });

  test("uses the domain when a link has no title", () => {
    expect(toBookmarksHtml([{ ...link, title: undefined }], [])).toContain(
      ">example.com</A>"
    );
  });

  test("keeps tags", () => {
    expect(
      toBookmarksHtml([{ ...link, tags: ["react", "docs"] }], [])
    ).toContain('TAGS="react,docs"');
  });

  test("puts links inside their folder", () => {
    const html = toBookmarksHtml(
      [{ ...link, folderId: "f1" }],
      [{ id: "f1", name: "Work" }]
    );

    expect(html).toMatch(
      /<DT><H3>Work<\/H3>\s*<DL><p>\s*<DT><A HREF="https:\/\/example.com\/a"/
    );
  });

  test("keeps empty folders", () => {
    expect(toBookmarksHtml([], [{ id: "f1", name: "Empty" }])).toContain(
      "<DT><H3>Empty</H3>"
    );
  });

  test("escapes titles, so a page title can't add its own HTML", () => {
    const html = toBookmarksHtml(
      [{ ...link, title: '<script>alert("hi")</script>' }],
      []
    );

    expect(html).toContain(
      "&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;"
    );
    expect(html).not.toContain("<script>");
  });
});

describe("parseBookmarksHtml", () => {
  // Shaped like a file exported from Chrome.
  const chromeFile = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1577836800" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://example.com/top" ADD_DATE="1577836800">On the bar</A>
        <DT><H3 ADD_DATE="1577836800">Recipes</H3>
        <DL><p>
            <DT><A HREF="https://example.com/soup" ADD_DATE="1577836800" TAGS="food, soup">Soup &amp; bread</A>
        </DL><p>
        <DT><A HREF="javascript:alert(1)">A bookmarklet</A>
    </DL><p>
    <DT><A HREF="https://example.com/loose">Loose</A>
</DL><p>`;

  test("reads each link with its title, tags and date", () => {
    const soup = parseBookmarksHtml(chromeFile).find(
      (b) => b.url === "https://example.com/soup"
    );

    expect(soup).toEqual({
      url: "https://example.com/soup",
      title: "Soup & bread",
      tags: ["food", "soup"],
      folder: "Recipes",
      addDate: "2020-01-01T00:00:00.000Z",
    });
  });

  test("links on the bookmarks bar or at the top get no folder", () => {
    const bookmarks = parseBookmarksHtml(chromeFile);

    expect(
      bookmarks.find((b) => b.url === "https://example.com/top")?.folder
    ).toBeUndefined();
    expect(
      bookmarks.find((b) => b.url === "https://example.com/loose")?.folder
    ).toBeUndefined();
  });

  test("skips links that aren't web addresses", () => {
    expect(parseBookmarksHtml(chromeFile).map((b) => b.url)).toEqual([
      "https://example.com/top",
      "https://example.com/soup",
      "https://example.com/loose",
    ]);
  });

  test("a file that isn't bookmarks gives an empty list", () => {
    expect(parseBookmarksHtml("hello")).toEqual([]);
  });

  test("reads Linkwell's own export back", () => {
    const html = toBookmarksHtml(
      [
        { ...link, tags: ["react"], folderId: "f1" },
        { ...link, id: "2", url: "https://example.com/b", title: "B" },
      ],
      [{ id: "f1", name: "Work" }]
    );

    expect(parseBookmarksHtml(html)).toEqual([
      {
        url: "https://example.com/a",
        title: "Example",
        tags: ["react"],
        folder: "Work",
        addDate: "2020-01-01T00:00:00.000Z",
      },
      {
        url: "https://example.com/b",
        title: "B",
        tags: [],
        folder: undefined,
        addDate: "2020-01-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("cleanBookmark", () => {
  const now = new Date("2020-06-01T00:00:00.000Z");
  const bookmark = { url: " https://example.com/a ", title: "  A  ", tags: ["React", " docs", "react"], folder: " Work ", addDate: "2020-01-01T00:00:00.000Z" };

  test("trims text and cleans tags like the save form does", () => {
    expect(cleanBookmark(bookmark, now)).toEqual({
      url: "https://example.com/a",
      title: "A",
      tags: ["react", "docs"],
      folder: "Work",
      addDate: "2020-01-01T00:00:00.000Z",
    });
  });

  test("refuses links that aren't web addresses", () => {
    expect(cleanBookmark({ ...bookmark, url: "javascript:alert(1)" }, now)).toBeNull();
    expect(cleanBookmark({ ...bookmark, url: 42 as unknown as string }, now)).toBeNull();
  });

  test("cuts very long titles and folder names", () => {
    const long = cleanBookmark({ ...bookmark, title: "x".repeat(1000), folder: "y".repeat(1000) }, now);

    expect(long?.title).toHaveLength(500);
    expect(long?.folder).toHaveLength(100);
  });

  test("drops dates in the future or that aren't dates", () => {
    expect(cleanBookmark({ ...bookmark, addDate: "2030-01-01T00:00:00.000Z" }, now)?.addDate).toBeUndefined();
    expect(cleanBookmark({ ...bookmark, addDate: "soon" }, now)?.addDate).toBeUndefined();
  });

  test("ignores tags that aren't text", () => {
    expect(cleanBookmark({ ...bookmark, tags: [1, "ok"] as unknown as string[] }, now)?.tags).toEqual(["ok"]);
  });
});
