import { afterEach, describe, expect, test } from "vitest";
import {
  STORAGE_KEY,
  createLink,
  timeAgo,
  getDomain,
  isDuplicate,
  loadLinks,
  clearSavedLinks,
  updateTitle,
  getFaviconUrl,
  parseTags,
  filterByTag,
  searchLinks,
  sortLinks,
  toLink,
} from "@/lib/links";
import { check } from "drizzle-orm/mysql-core";

afterEach(() => {
  localStorage.clear();
});

describe("createLink", () => {
  test("keeps the url it was given", () => {
    const link = createLink("https://example.com");

    expect(link.url).toBe("https://example.com");
  });

  test("gives every link a different id", () => {
    const first = createLink("https://example.com");
    const second = createLink("https://example.com");

    expect(first.id).not.toBe(second.id);
  });

  test("stores createdAt as an ISO date string", () => {
    const link = createLink("https://example.com");

    expect(new Date(link.createdAt).toISOString()).toBe(link.createdAt);
  });

  test("Keep the title it was given", () => {
    const link = createLink("https://example.com", "Example site");

    expect(link.title).toBe("Example site");
  });
  test("trims spaces around the title", () => {
    const link = createLink("https://example.com", "  Example site  ");

    expect(link.title).toBe("Example site");
  });
  test("has no title when none or only spaces are given", () => {
    expect(createLink("https://example.com").title).toBeUndefined();
    expect(createLink("https://example.com", "   ").title).toBeUndefined();
  });
  test("keeps the tags it was given", () => {
    const link = createLink("https://example.com", "", ["react", "news"]);

    expect(link.tags).toEqual(["react", "news"]);
  });

  test("has an empty tag list when none are given", () => {
    expect(createLink("https://example.com").tags).toEqual([]);
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-05T12:00:00.000Z");
  test("says 'just now' for less than a minute ago", () => {
    expect(timeAgo("2026-10-05T11:59:30.000Z", now)).toBe("just now");
  });

  test("counts minutes", () => {
    expect(timeAgo("2026-10-05T11:55:00.000Z", now)).toBe("5 minutes ago");
  });

  test("counts hours", () => {
    expect(timeAgo("2026-10-05T09:00:00.000Z", now)).toBe("3 hours ago");
  });

  test("says 'yesterday' for one day ago", () => {
    expect(timeAgo("2026-10-04T12:00:00.000Z", now)).toBe("yesterday");
  });

  test("counts days", () => {
    expect(timeAgo("2026-10-02T12:00:00.000Z", now)).toBe("3 days ago");
  });

  test("counts weeks", () => {
    expect(timeAgo("2026-09-21T12:00:00.000Z", now)).toBe("2 weeks ago");
  });

  test("counts months", () => {
    expect(timeAgo("2026-07-05T12:00:00.000Z", now)).toBe("3 months ago");
  });

  test("says 'last year' for one year ago", () => {
    expect(timeAgo("2025-10-05T12:00:00.000Z", now)).toBe("last year");
  });
});

describe("loadLinks and clearSavedLinks", () => {
  test("returns an empty list when nothing is saved", () => {
    expect(loadLinks()).toEqual([]);
  });

  test("loads links that were saved", () => {
    const links = [
      createLink("https://example.com"),
      createLink("https.nextjs.org"),
    ];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    expect(loadLinks()).toEqual(links);
  });

  test("returns an empty list when the saved data is invalid", () => {
    localStorage.setItem(STORAGE_KEY, "invalid json");

    expect(loadLinks()).toEqual([]);
  });

  test("clearSavedLinks removes the saved links", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([createLink("https://example.com")]));

    clearSavedLinks();

    expect(loadLinks()).toEqual([]);
  });
});

describe("getDomain", () => {
  test("returns the domain of a URL", () => {
    expect(getDomain("https://nextjs.org/docs/app")).toBe("nextjs.org");
  });

  test("drop a leading www", () => {
    expect(getDomain("https://www.example.com/path")).toBe("example.com");
  });

  test("returns the text unchanged if the URL is invalid", () => {
    expect(getDomain("not a url")).toBe("not a url");
  });
});

describe("isDuplicate", () => {
  const links = [createLink("https://example.com/page")];

  test("is false when the list is empty", () => {
    expect(isDuplicate([], "https://example.com/page")).toBe(false);
  });

  test("is true when the url is already saved", () => {
    expect(isDuplicate(links, "https://example.com/page")).toBe(true);
  });

  test("is false for a different url", () => {
    expect(isDuplicate(links, "https://example.com/other")).toBe(false);
  });

  test("ignores uppercase letters in the domain", () => {
    expect(isDuplicate(links, "https://EXAMPLE.com/page")).toBe(true);
  });

  test("treats a domain with and without a trailing slash as the same", () => {
    const saved = [createLink("https://example.com")];

    expect(isDuplicate(saved, "https://example.com/")).toBe(true);
  });
});

describe("updateTitle", () => {
  const first = createLink("https://example.com", "Old title");
  const second = createLink("https://nextjs.org", "Next.js");

  test("changes the title of the matching link", () => {
    const updated = updateTitle([first, second], first.id, "New title");

    expect(updated[0].title).toBe("New title");
  });

  test("leaves the other links alone", () => {
    const updated = updateTitle([first, second], first.id, "New title");

    expect(updated[1]).toBe(second);
  });

  test("does not change the original list", () => {
    updateTitle([first, second], first.id, "New title");

    expect(first.title).toBe("Old title");
  });

  test("trims spaces around the title", () => {
    const updated = updateTitle([first], first.id, "  New title  ");

    expect(updated[0].title).toBe("New title");
  });

  test("removes the title when it is empty", () => {
    const updated = updateTitle([first], first.id, "   ");

    expect(updated[0].title).toBeUndefined();
  });
});

describe("getFaviconUrl", () => {
  test("returns a favicon address for the link's domain", () => {
    expect(getFaviconUrl("https://nextjs.org/docs")).toBe(
      "https://www.google.com/s2/favicons?domain=nextjs.org&sz=32"
    );
  });

  test("returns null when the URL is invalid", () => {
    expect(getFaviconUrl("not a url")).toBeNull();
  });
});

describe("parseTags", () => {
  test("splits text on commas", () => {
    expect(parseTags("news,react,css")).toEqual(["news", "react", "css"]);
  });

  test("trims spaces and lowercases each tag", () => {
    expect(parseTags("  News , React ")).toEqual(["news", "react"]);
  });

  test("skips empty tags", () => {
    expect(parseTags("news,, ,react,")).toEqual(["news", "react"]);
  });

  test("removes duplicate tags", () => {
    expect(parseTags("react, React, news")).toEqual(["react", "news"]);
  });

  test("returns an empty list for empty text", () => {
    expect(parseTags("")).toEqual([]);
    expect(parseTags("   ")).toEqual([]);
  });
});

describe("filterByTag", () => {
  const react = createLink("https://react.dev", "", ["react", "docs"]);
  const news = createLink("https://news.ycombinator.com", "", ["news"]);
  const old = {
    id: "old",
    url: "https://old.com",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  test("returns every link when no tag is chosen", () => {
    expect(filterByTag([react, news, old], null)).toEqual([react, news, old]);
  });

  test("keeps only links with the chosen tag", () => {
    expect(filterByTag([react, news, old], "react")).toEqual([react]);
  });

  test("skips links saved before tags existed", () => {
    expect(filterByTag([old], "react")).toEqual([]);
  });
});

describe("searchLinks", () => {
  const react = createLink("https://react.dev", "React docs");
  const news = createLink("https://news.ycombinator.com");

  test("returns every link when the search is empty", () => {
    expect(searchLinks([react, news], "  ")).toEqual([react, news]);
  });

  test("finds links by title, ignoring case", () => {
    expect(searchLinks([react, news], "DOCS")).toEqual([react]);
  });

  test("finds links by url", () => {
    expect(searchLinks([react, news], "ycombinator")).toEqual([news]);
  });

  test("returns nothing when no link matches", () => {
    expect(searchLinks([react, news], "vue")).toEqual([]);
  });
});

describe("sortLinks", () => {
  const first = {
    id: "1",
    url: "https://zebra.com",
    createdAt: "2026-10-01T12:00:00.000Z",
  };
  const second = {
    id: "2",
    url: "https://apple.com",
    title: "Banana",
    createdAt: "2026-10-02T12:00:00.000Z",
  };
  const third = {
    id: "3",
    url: "https://cherry.com",
    title: "apple pie",
    createdAt: "2026-10-03T12:00:00.000Z",
  };
  const links = [second, third, first];

  test("puts the newest link first", () => {
    expect(sortLinks(links, "newest")).toEqual([third, second, first]);
  });

  test("puts the oldest link first", () => {
    expect(sortLinks(links, "oldest")).toEqual([first, second, third]);
  });

  test("sorts by title A to Z, ignoring case, using the domain when there's no title", () => {
    expect(sortLinks(links, "title")).toEqual([third, second, first]);
  });

  test("does not change the original list", () => {
    sortLinks(links, "oldest");

    expect(links).toEqual([second, third, first]);
  });
});

describe("toLink", () => {
  const row = {
    id: "1",
    url: "https://example.com",
    title: null,
    tags: ["news"],
    createdAt: new Date("2026-10-06T12:00:00.000Z"),
    status: null,
    checkedAt: null,
  };

  test("turns the date into an ISO string", () => {
    expect(toLink(row).createdAt).toBe("2026-10-06T12:00:00.000Z");
  });

  test("turns an empty title into undefined", () => {
    expect(toLink(row).title).toBeUndefined();
  });

  test("keeps the id, url and tags", () => {
    expect(toLink(row)).toMatchObject({ id: "1", url: "https://example.com", tags: ["news"] });
  });

  test("leaves the status out when the link was never checked", () => {
    expect(toLink(row).status).toBeUndefined();
    expect(toLink(row).checkedAt).toBeUndefined();
  });

  test("keeps the result of the last check", () => {
    const checked = { ...row, status: "broken" as const, checkedAt: new Date("2026-10-07T08:00:00.000Z") };

    expect(toLink(checked)).toMatchObject({ status: "broken", checkedAt: "2026-10-07T08:00:00.000Z" });
  });
});