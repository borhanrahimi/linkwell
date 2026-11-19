import { writeFileSync } from "node:fs";
import { devices, type Page } from "@playwright/test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { expect, test } from "./fixtures";

// v2.5 "Ready for 10,000 links": fills a brand-new test user with 10,000
// made-up links in 200 folders, then times what people wait for: the first
// screen, All links, a search and opening a folder, on a computer and on a
// phone (a phone-sized screen with the processor slowed down 4 times).
// Not a test: it only runs with `npm run measure`, and only ever against the
// test database. The user (and so every link) is deleted afterwards.
// The numbers are printed, and saved in test-results/scale-<SCALE_LABEL>.json
// until the next test run clears that folder: copy them into the roadmap.
test.skip(!process.env.SCALE, "Run with npm run measure");
test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

const LINKS = Number(process.env.SCALE_LINKS ?? 10_000);
const FOLDERS = 200;
// A word that's in exactly this many titles and nowhere else, so a search
// for it has a known answer.
const NEEDLE = "zanzibar";
const NEEDLE_COUNT = 37;
const DAY = 86_400_000;

// Always the same made-up data (a small seeded random number generator).
function random(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
}
const WORDS = ["notes", "guide", "recipe", "design", "history", "tips", "review", "garden", "rust", "calm", "travel", "budget", "music", "maps", "react", "sql", "coffee", "bikes", "poems", "chess"];
const TAGS = Array.from({ length: 60 }, (_, i) => `tag${i}`);

type Seeded = { folderWithMost: { id: string; name: string; count: number } };

async function seed(userId: string): Promise<Seeded> {
  const db = drizzle(process.env.E2E_DATABASE_URL!, { schema });
  const next = random(42);
  const pick = <T,>(items: T[]) => items[Math.floor(next() * items.length)];

  // 40 top-level folders with 4 folders inside each: 200 in all.
  const folders: (typeof schema.folders.$inferInsert)[] = [];
  for (let top = 0; top < FOLDERS / 5; top++) {
    const id = crypto.randomUUID();
    folders.push({ id, userId, name: `Folder ${top}`, color: "blue", position: top });
    for (let inside = 0; inside < 4; inside++) {
      folders.push({ id: crypto.randomUUID(), userId, name: `Folder ${top}.${inside}`, color: "green", parentId: id, position: inside });
    }
  }
  await db.insert(schema.folders).values(folders);

  const now = Date.now();
  const rows: (typeof schema.links.$inferInsert)[] = [];
  for (let i = 0; i < LINKS; i++) {
    const words = [pick(WORDS), pick(WORDS), pick(WORDS)];
    if (i % Math.floor(LINKS / NEEDLE_COUNT) === 0 && rows.filter((r) => r.title?.includes(NEEDLE)).length < NEEDLE_COUNT) {
      words.push(NEEDLE);
    }
    rows.push({
      userId,
      url: `https://example.com/${i}/${words.join("-")}`,
      title: `${words.join(" ")} ${i}`,
      tags: next() < 0.6 ? [pick(TAGS), pick(TAGS)].filter((t, n, all) => all.indexOf(t) === n) : [],
      note: next() < 0.2 ? `Saved because of the ${pick(WORDS)} part.` : null,
      // Spread over the last 400 days.
      createdAt: new Date(now - Math.floor(next() * 400 * DAY)),
      readAt: next() < 0.3 ? new Date(now - Math.floor(next() * 30 * DAY)) : null,
      status: next() < 0.03 ? "broken" : "ok",
      image: "",
      folderId: next() < 0.15 ? null : pick(folders).id!,
    });
  }
  for (let i = 0; i < rows.length; i += 1000) {
    await db.insert(schema.links).values(rows.slice(i, i + 1000));
  }

  const perFolder = new Map<string, number>();
  const topLevel = new Set(folders.filter((f) => !f.parentId).map((f) => f.id));
  for (const row of rows) if (row.folderId && topLevel.has(row.folderId)) perFolder.set(row.folderId, (perFolder.get(row.folderId) ?? 0) + 1);
  const [id, count] = [...perFolder].sort((a, b) => b[1] - a[1])[0];
  return { folderWithMost: { id, name: folders.find((f) => f.id === id)!.name, count } };
}

const ms = (start: number) => Math.round(performance.now() - start);

// How much the page sends (in kB, before compression): its HTML, with the
// data React needs inside it.
async function pageSize(page: Page, path: string) {
  return Math.round((await (await page.request.get(path)).body()).length / 1024);
}

// Types the needle a letter at a time, like a person, and returns the longest
// a letter kept the page busy (input until the next frame) and how long the
// answer took to show after the last letter.
async function timeSearch(page: Page) {
  const box = page.getByRole("searchbox", { name: "Search links" });
  await box.click();
  const lags: number[] = [];
  for (const letter of NEEDLE) {
    lags.push(
      await page.evaluate(
        (key) =>
          new Promise<number>((resolve) => {
            const input = document.activeElement as HTMLInputElement;
            const start = performance.now();
            const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
            setValue.call(input, input.value + key);
            input.dispatchEvent(new Event("input", { bubbles: true }));
            requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - start)));
          }),
        letter
      )
    );
    await page.waitForTimeout(80);
  }
  const start = performance.now();
  await expect(page.getByText(`${NEEDLE_COUNT} links`, { exact: true })).toBeVisible({ timeout: 30_000 });
  return { worstKeystroke: Math.round(Math.max(...lags)), answerAfterLastKey: ms(start) };
}

async function measure(page: Page, seeded: Seeded, phone: boolean) {
  const result: Record<string, number> = {};

  // The first screen: Home, from asking for the page until it can be used.
  let start = performance.now();
  await page.goto("/");
  await expect(page.getByText("Recently saved").first()).toBeVisible({ timeout: 60_000 });
  result.homeMs = ms(start);
  result.homeKb = await pageSize(page, "/");

  // All links: the whole list (or its first part).
  start = performance.now();
  await page.goto("/?list=all");
  await expect(page.getByRole("list", { name: "Links" }).getByRole("listitem").first()).toBeVisible({ timeout: 60_000 });
  result.allLinksMs = ms(start);
  result.allLinksKb = await pageSize(page, "/?list=all");
  result.cardsDrawn = await page.getByRole("list", { name: "Links" }).getByRole("listitem").count();
  result.domNodes = await page.evaluate(() => document.getElementsByTagName("*").length);

  // A search, typed a letter at a time.
  Object.assign(result, await timeSearch(page));

  // Opening the folder with the most links, from the sidebar (or the address
  // on phones, which have no sidebar).
  const { folderWithMost } = seeded;
  start = performance.now();
  if (phone) {
    await page.goto(`/?folder=${folderWithMost.id}`);
  } else {
    await page.goto("/");
    await expect(page.getByText("Recently saved").first()).toBeVisible({ timeout: 60_000 });
    start = performance.now();
    await page.getByRole("navigation", { name: "Your lists" }).getByRole("button", { name: new RegExp(`^${folderWithMost.name}\\b(?!\\.)`) }).first().click();
  }
  await expect(page.getByRole("heading", { level: 2, name: folderWithMost.name, exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("list", { name: "Links" }).getByRole("listitem").first()).toBeVisible({ timeout: 60_000 });
  result.openFolderMs = ms(start);
  return result;
}

// What the database does for the questions asked most (EXPLAIN ANALYZE runs
// the query and says how: "Index Scan" uses an index, "Seq Scan" reads the
// whole table). Prints each plan's outline and how long it took.
async function explain(userId: string, folderId: string) {
  const db = drizzle(process.env.E2E_DATABASE_URL!, { schema });
  const questions = {
    "first page, newest first": sql`select * from links where user_id = ${userId} and deleted_at is null order by created_at desc, id desc limit 51`,
    "a page deep in the list": sql`select * from links where user_id = ${userId} and deleted_at is null and (created_at, id) < (now() - interval '300 days', 'ffffffff-ffff-4fff-bfff-ffffffffffff'::uuid) order by created_at desc, id desc limit 51`,
    "a folder's links": sql`select * from links where user_id = ${userId} and deleted_at is null and folder_id = ${folderId}::uuid order by created_at desc, id desc limit 51`,
    "the sidebar's counts": sql`select count(*), count(*) filter (where read_at is null) from links where user_id = ${userId} and deleted_at is null`,
    "a search": sql`select count(*) from links where user_id = ${userId} and deleted_at is null and concat_ws(' ', title, url, note, array_to_string(tags, ' ')) ilike '%zanzibar%'`,
  };
  const plans: Record<string, string> = {};
  for (const [name, question] of Object.entries(questions)) {
    const result = await db.execute<{ "QUERY PLAN": string }>(sql`explain (analyze, costs off) ${question}`);
    const lines = result.rows.map((row) => row["QUERY PLAN"]);
    plans[name] = [...lines.filter((line) => /Scan|Sort|Aggregate|Limit/.test(line)).map((line) => line.trim()), lines.at(-1)!.trim()].join(" | ");
  }
  return plans;
}

test("measure 10,000 links", async ({ browser, page, signIn }) => {
  const userId = await signIn("Big Collection");
  const seedStart = performance.now();
  const seeded = await seed(userId);
  console.log(`Seeded ${LINKS} links in ${FOLDERS} folders in ${ms(seedStart)} ms`);

  // Warm up the server (the first request after starting is always slow).
  await page.goto("/");
  await expect(page.getByText("Recently saved").first()).toBeVisible({ timeout: 60_000 });

  const computer = await measure(page, seeded, false);

  // A phone: its screen size and touch, and a processor 4 times slower.
  const phoneContext = await browser.newContext({ ...devices["Pixel 7"], baseURL: test.info().project.use.baseURL });
  await phoneContext.addCookies(await page.context().cookies());
  const phonePage = await phoneContext.newPage();
  const cdp = await phoneContext.newCDPSession(phonePage);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const phone = await measure(phonePage, seeded, true);
  await phoneContext.close();

  const plans = await explain(userId, seeded.folderWithMost.id);
  for (const [name, plan] of Object.entries(plans)) console.log(`${name}:\n  ${plan}`);

  const results = { when: new Date().toISOString(), links: LINKS, folders: FOLDERS, computer, phone, plans };
  console.table({ computer, phone });
  writeFileSync(`test-results/scale-${process.env.SCALE_LABEL ?? "run"}.json`, JSON.stringify(results, null, 2));
});
