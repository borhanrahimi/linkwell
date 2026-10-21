import { expect, test } from "./fixtures";

// Takes the landing page's screenshots of the app (public/screenshots/), in
// light and dark mode, on a computer and a phone. Not a test: it only runs
// with `npm run screenshots`, so redo the pictures whenever the app changes.
// The sample links use made-up titles and example addresses (no real brands).
test.skip(!process.env.SCREENSHOTS, "Run with npm run screenshots");

const DAY = 86400;
const now = Math.floor(Date.now() / 1000);
// folder, address, title, saved how many days ago, tags
const SAMPLES = [
  ["Reading", "https://example.org/hyperlink-history", "The long history of the hyperlink", 70, "web,history"],
  ["Recipes", "https://example.com/saffron-rice", "Saffron rice with barberries", 40, "food,persian"],
  ["Work", "https://example.net/keyboard-shortcuts", "Keyboard shortcuts worth learning", 20, "tips"],
  ["", "https://example.org/coast-hikes", "Weekend hikes near the coast", 12, "travel"],
  ["Work", "https://example.net/database-indexes", "A gentle guide to database indexes", 5, "db,performance"],
  ["Reading", "https://example.com/calm-interfaces", "How to write calm interfaces", 3, "design,ux"],
  ["Recipes", "https://example.com/sourdough", "Sourdough starter, step by step", 2, "food"],
  ["", "https://example.org/css-grid", "Notes on CSS grid layouts", 1, "css,web,design"],
] as const;

function bookmarksFile() {
  const folders = [...new Set(SAMPLES.map(([folder]) => folder).filter(Boolean))];
  const entry = ([, url, title, days, tags]: (typeof SAMPLES)[number]) =>
    `<DT><A HREF="${url}" ADD_DATE="${now - days * DAY}" TAGS="${tags}">${title}</A>`;
  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<DL><p>",
    ...folders.map(
      (folder) => `<DT><H3>${folder}</H3><DL><p>${SAMPLES.filter(([f]) => f === folder).map(entry).join("")}</DL><p>`
    ),
    ...SAMPLES.filter(([folder]) => !folder).map(entry),
    "</DL><p>",
  ].join("\n");
}

const SHOTS = [
  { name: "app", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
] as const;

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    // Twice the pixels, so the pictures stay sharp on high-resolution screens.
    test.use({ colorScheme, deviceScaleFactor: 2, viewport: { width: 1280, height: 800 } });

    test("screenshots", async ({ page, signIn }) => {
      await signIn("Sam");
      await page.goto("/account");
      await page.getByLabel("Choose bookmarks file").setInputFiles({
        name: "bookmarks.html",
        mimeType: "text/html",
        buffer: Buffer.from(bookmarksFile()),
      });
      await page.getByRole("button", { name: /Import \d+ links/ }).click();
      await page.getByText(/Imported \d+ links/).waitFor();

      await page.goto("/");
      // One link read, one with a note.
      const card = (title: string) =>
        page.getByRole("listitem").filter({ has: page.getByRole("link", { name: title, exact: true }) });
      await card("How to write calm interfaces").getByRole("button", { name: "Mark read" }).click();
      await expect(card("How to write calm interfaces").getByRole("button", { name: "Mark unread" })).toBeVisible();
      await card("Saffron rice with barberries").getByRole("button", { name: "Edit" }).click();
      await page.getByRole("textbox", { name: "Note" }).fill("For Friday dinner with friends");
      await page.getByRole("button", { name: "Save", exact: true }).last().click();
      await expect(page.getByText("For Friday dinner with friends")).toBeVisible();

      for (const shot of SHOTS) {
        await page.setViewportSize({ width: shot.width, height: shot.height });
        await page.goto("/");
        await page.getByRole("region", { name: /^Rediscover/ }).waitFor();
        // No hover, focus ring or blinking cursor in the picture.
        await page.mouse.move(0, 0);
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.waitForTimeout(500);
        await page.screenshot({ path: `public/screenshots/${shot.name}-${colorScheme}.png` });
      }
    });
  });
}
