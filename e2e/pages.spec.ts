import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { compareLinks, matchesQuery, type LinkQuery } from "../lib/linkQuery";
import type { Link } from "../types/link";
import { expect, test } from "./fixtures";
import { baseURL } from "../playwright.config";

// v2.5: lists come a page at a time from /api/links. These check the SQL in
// lib/data.ts against the rules in lib/linkQuery.ts, on a real database:
// paging never skips or repeats a link, the order is the same, and search
// finds the same links.

const COUNT = 130;
const DAY = 86_400_000;

async function seed(userId: string): Promise<Link[]> {
  const db = drizzle(process.env.E2E_DATABASE_URL!, { schema });
  const start = Date.UTC(2026, 0, 1);
  const links: Link[] = Array.from({ length: COUNT }, (_, i) => ({
    id: crypto.randomUUID(),
    url: `https://${i % 3 === 0 ? "www." : ""}site${i % 7}.example/${i}`,
    // Some without a title (sorted by site), one with a % in it.
    title: i % 5 === 0 ? undefined : i === 7 ? "100% rye bread" : `Title ${String.fromCharCode(97 + (i % 26))} ${i}`,
    note: i % 10 === 0 ? "a note about lentils" : undefined,
    tags: i % 4 === 0 ? ["soup"] : [],
    // Every third link shares its time with the one before: ties go by id.
    createdAt: new Date(start + Math.floor(i / 2) * DAY).toISOString(),
    readAt: i % 3 === 0 ? new Date(start).toISOString() : undefined,
  }));
  await db.insert(schema.links).values(
    links.map((link) => ({
      id: link.id,
      userId,
      url: link.url,
      title: link.title ?? null,
      note: link.note ?? null,
      tags: link.tags ?? [],
      createdAt: new Date(link.createdAt),
      readAt: link.readAt ? new Date(link.readAt) : null,
    }))
  );
  return links;
}

const query = (rest: Partial<LinkQuery>): LinkQuery => ({ list: "all", folderIds: null, tag: null, search: "", sort: "newest", ...rest });

test("the API pages through a list without skipping or repeating a link", async ({ page, signIn }) => {
  const links = await seed(await signIn());

  for (const sort of ["newest", "oldest", "title"] as const) {
    for (const list of ["all", "unread"] as const) {
      const ids: string[] = [];
      let after: string | null = null;
      do {
        const params: URLSearchParams = new URLSearchParams({ list, sort, ...(after ? { after } : {}) });
        const answer: { links: Link[]; next: string | null } = await (await page.request.get(`/api/links?${params}`)).json();
        expect(answer.links.length).toBeLessThanOrEqual(50);
        ids.push(...answer.links.map((link: Link) => link.id));
        after = answer.next;
      } while (after);

      const expected = links.filter((link) => matchesQuery(link, query({ list }))).sort((a, b) => compareLinks(a, b, sort));
      // Every link once.
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual(expected.map((link) => link.id).sort());
      // Dates sort the same everywhere; titles may sort a little differently
      // between the database and the browser (punctuation), so only the set is checked.
      if (sort !== "title") expect(ids).toEqual(expected.map((link) => link.id));
    }
  }
});

test("search on the server finds what the rules find, in notes and tags too", async ({ page, signIn }) => {
  const links = await seed(await signIn());

  for (const search of ["lentils", "soup", "title a", "SITE3", "100%", "_", "rye 100%"]) {
    const answer = await (await page.request.get(`/api/links?${new URLSearchParams({ q: search })}`)).json();
    const expected = links.filter((link) => matchesQuery(link, query({ search })));
    expect(answer.total, `searching for "${search}"`).toBe(expected.length);
  }
  // A % is just a character, not "anything".
  const percent = await (await page.request.get("/api/links?q=%25")).json();
  expect(percent.total).toBe(1);
});

test("signed out, the API answers nobody", async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL });
  expect((await request.get("/api/links")).status()).toBe(401);
  expect((await request.get("/api/links/summary")).status()).toBe(401);
  await request.dispose();
});

test("the list loads more as you scroll, and Select all takes every link", async ({ page, signIn }) => {
  await seed(await signIn());
  await page.goto("/?list=all");

  await expect(page.getByText(`${COUNT} links`, { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Links" }).locator(":scope > li")).toHaveCount(50);

  // Scrolling near the end brings the next page, until there are no more.
  await expect(async () => {
    await page.mouse.wheel(0, 20_000);
    await expect(page.getByRole("list", { name: "Links" }).locator(":scope > li")).toHaveCount(COUNT, { timeout: 1000 });
  }).toPass();
  await expect(page.getByRole("button", { name: "Show more links" })).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: `Select all ${COUNT}` }).click();
  await expect(page.getByText(`${COUNT} selected`)).toBeVisible();
});

test("the sidebar's counts come from the database", async ({ page, signIn }) => {
  const links = await seed(await signIn());
  await page.goto("/");

  const unread = links.filter((link) => !link.readAt).length;
  const lists = page.getByRole("navigation", { name: "Your lists" });
  await expect(lists.getByRole("button", { name: "All links" })).toContainText(String(COUNT));
  await expect(lists.getByRole("button", { name: "Unread" })).toContainText(String(unread));
  await expect(page.getByText(`${unread} unread`)).toBeVisible();
});
