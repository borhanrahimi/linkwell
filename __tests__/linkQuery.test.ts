import { describe, expect, test } from "vitest";
import {
  addNewLinks,
  compareLinks,
  imagesInside,
  liveSummary,
  matchesSearch,
  queryFromParams,
  queryKey,
  queryLinks,
  queryToParams,
  readCursor,
  makeCursor,
  shownQuery,
  summarize,
  withNewLink,
  type LinkQuery,
} from "@/lib/linkQuery";
import type { Folder, Link } from "@/types/link";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-18T12:00:00.000Z");
const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const link = (n: number, rest: Partial<Link> = {}): Link => ({ id: id(n), url: `https://example.com/${n}`, createdAt: ago(n), tags: [], ...rest });

const folders: Folder[] = [
  { id: id(100), name: "Work" },
  { id: id(101), name: "Clients", parentId: id(100) },
  { id: id(102), name: "Recipes" },
];
const all: LinkQuery = { list: "all", folderIds: null, tag: null, search: "", sort: "newest" };

describe("search", () => {
  test("looks in the title, address, note and tags, ignoring case", () => {
    const soup = link(1, { title: "Lentil Soup", note: "for winter", tags: ["food"] });
    expect(matchesSearch(soup, "soup")).toBe(true);
    expect(matchesSearch(soup, "EXAMPLE.COM")).toBe(true);
    expect(matchesSearch(soup, "winter")).toBe(true);
    expect(matchesSearch(soup, "food")).toBe(true);
    expect(matchesSearch(soup, "pasta")).toBe(false);
  });

  test("every word must be found, in any order and any field", () => {
    const soup = link(1, { title: "Lentil soup", tags: ["food"] });
    expect(matchesSearch(soup, "food lentil")).toBe(true);
    expect(matchesSearch(soup, "food pasta")).toBe(false);
  });

  test("an empty search finds everything", () => {
    expect(matchesSearch(link(1), "   ")).toBe(true);
  });
});

describe("queries", () => {
  const links = [
    link(1, { readAt: ago(0), folderId: id(100), tags: ["db"] }),
    link(2, { folderId: id(101), status: "broken" }),
    link(3, { tags: ["db"] }),
  ];

  test("lists, folders and tags narrow the links down", () => {
    const ids = (query: Partial<LinkQuery>) => queryLinks(links, { ...all, ...query }).map((l) => l.id);
    expect(ids({ list: "unread" })).toEqual([id(2), id(3)]);
    expect(ids({ list: "broken" })).toEqual([id(2)]);
    expect(ids({ list: "unsorted" })).toEqual([id(3)]);
    expect(ids({ folderIds: [id(100)] })).toEqual([id(1)]);
    expect(ids({ folderIds: [id(100), id(101)] })).toEqual([id(1), id(2)]);
    expect(ids({ notInFolder: id(100) })).toEqual([id(2), id(3)]);
    expect(ids({ tag: "db" })).toEqual([id(1), id(3)]);
  });

  test("sorts newest first, oldest first, or by title; ties by id so pages never skip one", () => {
    const same = ago(5);
    const a = link(7, { createdAt: same, title: "b" });
    const b = link(8, { createdAt: same, title: "a" });
    expect([b, a].sort((x, y) => compareLinks(x, y, "newest")).map((l) => l.id)).toEqual([id(8), id(7)]);
    expect([b, a].sort((x, y) => compareLinks(x, y, "oldest")).map((l) => l.id)).toEqual([id(7), id(8)]);
    expect([a, b].sort((x, y) => compareLinks(x, y, "title")).map((l) => l.title)).toEqual(["a", "b"]);
  });

  test("a link with no title sorts by its site's name", () => {
    const named = link(1, { title: "Middle" });
    const bare = link(2, { url: "https://www.zebra.org/x" });
    const early = link(3, { url: "https://apple-pie.net/" });
    expect(queryLinks([named, bare, early], { ...all, sort: "title" }).map((l) => l.id)).toEqual([id(3), id(1), id(2)]);
  });

  test("a query goes into the address and comes back the same", () => {
    const query: LinkQuery = { list: "unread", folderIds: [id(100), id(101)], notInFolder: id(102), tag: "db", search: "soup", sort: "title" };
    expect(queryFromParams(queryToParams(query))).toEqual(query);
    expect(queryKey(queryFromParams(queryToParams(query)))).toBe(queryKey(query));
  });

  test("reading one back trusts nothing odd", () => {
    const query = queryFromParams(new URLSearchParams("list=everything&sort=random&folder=../etc&notin=x&q=" + "a".repeat(500)));
    expect(query).toEqual({ list: "all", folderIds: null, notInFolder: null, tag: null, search: "a".repeat(200), sort: "newest" });
  });

  test("the list on screen: none on Home, Folders and the Trash; a folder that's gone is no folder", () => {
    expect(shownQuery(folders, { list: "home", folder: null, tag: null })).toBeNull();
    expect(shownQuery(folders, { list: "folders", folder: null, tag: null })).toBeNull();
    expect(shownQuery(folders, { list: "trash", folder: null, tag: null })).toBeNull();
    expect(shownQuery(folders, { list: "home", folder: null, tag: "db" })).toMatchObject({ list: "all", tag: "db" });
    expect(shownQuery(folders, { list: "home", folder: id(999), tag: null })).toBeNull();
    expect(shownQuery(folders, { list: "home", folder: id(100), tag: null })).toMatchObject({ folderIds: [id(100)] });
    expect(shownQuery(folders, { list: "home", folder: id(100), tag: null }, { withInside: true })?.folderIds?.sort()).toEqual([id(100), id(101)]);
  });
});

describe("cursors", () => {
  test("come back as they went", () => {
    expect(readCursor(makeCursor("2026-11-18 12:00:00.123456+00", id(1)))).toEqual({ key: "2026-11-18 12:00:00.123456+00", id: id(1) });
  });

  test("anything odd means starting from the beginning", () => {
    expect(readCursor(null)).toBeNull();
    expect(readCursor("not json")).toBeNull();
    expect(readCursor(JSON.stringify(["x", "not-a-uuid"]))).toBeNull();
    expect(readCursor(JSON.stringify([1, id(1)]))).toBeNull();
    expect(readCursor("x".repeat(3000))).toBeNull();
  });
});

describe("the summary", () => {
  const links = [
    link(1, { readAt: ago(0), folderId: id(101), image: "/a.svg" }),
    link(2, { folderId: id(100), status: "broken", tags: ["db", "web"] }),
    link(3, { tags: ["db"], image: "/c.svg" }),
    link(20, { folderId: id(100), image: "/d.svg" }),
    link(30),
  ];
  const summary = summarize(links, now);

  test("counts the lists, this week, each folder and each tag", () => {
    expect(summary).toMatchObject({ total: 5, unread: 4, broken: 1, unsorted: 2, thisWeek: 3 });
    expect(summary.byFolder).toEqual({ [id(100)]: 2, [id(101)]: 1 });
    expect(summary.tags).toEqual([
      { tag: "db", count: 2 },
      { tag: "web", count: 1 },
    ]);
  });

  test("Home's links: newest unread, newest, and old unread ones (not broken) to rediscover", () => {
    expect(summary.unreadLinks.map((l) => l.id)).toEqual([id(2), id(3), id(20), id(30)]);
    expect(summary.recentLinks.map((l) => l.id)).toEqual([id(1), id(2), id(3), id(20), id(30)]);
    expect(summary.rediscoverLinks.map((l) => l.id)).toEqual([id(30), id(20)]);
  });

  test("a folder tile shows the newest pictures in it and the folders inside it", () => {
    expect(imagesInside(folders, summary.images, id(100))).toEqual(["/a.svg", "/d.svg"]);
    expect(imagesInside(folders, summary.images, id(102))).toEqual([]);
  });

  test("Home follows the page's own copy of a link at once (marked read, deleted)", () => {
    const changed = [{ ...links[1], readAt: ago(0) }, links[2], links[3]];
    const live = liveSummary(summary, changed);
    expect(live.unreadLinks.map((l) => l.id)).toEqual([id(3), id(20)]);
    expect(live.recentLinks.map((l) => l.id)).toEqual([id(2), id(3), id(20)]);
  });

  test("a link just saved counts at once, before the server's next summary", () => {
    const fresh = withNewLink(summary, link(0, { folderId: id(102) }));
    expect(fresh).toMatchObject({ total: 6, unread: 5, unsorted: 2, thisWeek: 4 });
    expect(fresh.byFolder[id(102)]).toBe(1);
    expect(fresh.recentLinks[0].id).toBe(id(0));
    expect(fresh.unreadLinks[0].id).toBe(id(0));
  });

  test("without the time, nothing is this week or old enough to rediscover", () => {
    expect(summarize(links)).toMatchObject({ thisWeek: 0, rediscoverLinks: [] });
  });
});

test("new links from the server are added; ones the page has are kept as the page has them", () => {
  const mine = [link(1, { readAt: ago(0) })];
  const merged = addNewLinks(mine, [link(1), link(2)]);
  expect(merged.map((l) => l.id)).toEqual([id(1), id(2)]);
  expect(merged[0].readAt).toBeDefined();
  expect(addNewLinks(mine, [link(1)])).toBe(mine);
});
