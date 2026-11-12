import { test, expect, saveLink } from "./fixtures";
import type { Locator, Page } from "@playwright/test";

// v2.4: dragging links and folders with a mouse, a finger and the keyboard.

async function newFolder(page: Page, name: string) {
  await page.getByRole("button", { name: "+ New folder" }).filter({ visible: true }).click();
  await page.getByRole("textbox", { name: "Folder name" }).filter({ visible: true }).fill(name);
  await page.getByRole("button", { name: "Create" }).filter({ visible: true }).click();
  // Made once the server answers: then it's in the tree.
  await expect(page.locator("[data-folder]").filter({ visible: true, hasText: name })).toBeVisible();
}

// The middle of an element, or a spot `fromTop` of the way down it.
async function spot(locator: Locator, fromTop = 0.5) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height * fromTop };
}

// The folder names in a tree, top to bottom.
async function order(tree: Locator) {
  return (await tree.locator("[data-folder]").allInnerTexts()).map((text) => text.replace(/\d+$/, "").trim());
}

test("with a mouse: a link onto a folder, and a folder before another", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/?list=all");
  const folders = page.getByRole("list", { name: "Folders", exact: true });
  await newFolder(page, "Work");
  await newFolder(page, "Home");
  await saveLink(page, "https://example.com/drag-me", "Drag me");
  const card = page.getByRole("list", { name: "Links" }).getByRole("listitem").filter({ hasText: "Drag me" });

  // Press on the card's empty space, move onto Home, let go.
  const from = await spot(card.locator("p").first(), 0.5);
  const to = await spot(folders.getByRole("button", { name: "Home", exact: true }));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await expect(folders.getByRole("button", { name: "Home", exact: true })).toHaveClass(/drop-into/);
  await page.mouse.up();
  await expect(page.getByText("Moved to Home")).toBeVisible();
  // The click the drag ended with didn't open the details panel.
  await expect(page.getByRole("complementary")).toHaveCount(0);

  // Home, near the top edge of Work: before it.
  const home = await spot(folders.getByRole("button", { name: "Home", exact: true }));
  const work = await spot(folders.getByRole("button", { name: "Work", exact: true }), 0.1);
  await page.mouse.move(home.x, home.y);
  await page.mouse.down();
  await page.mouse.move(work.x, work.y, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByText('"Home" moved up')).toBeVisible();

  // Both kept after a reload (the server catches up a moment later).
  await expect(async () => {
    await page.reload();
    expect(await order(folders)).toEqual(["Home", "Work"]);
    await folders.getByRole("button", { name: "Home", exact: true }).click();
    await expect(page.getByRole("list", { name: "Links" }).getByRole("link", { name: "Drag me" })).toBeVisible({ timeout: 1000 });
  }).toPass();
});

test.describe("with a finger", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  // A real touch: press, hold, slide and let go (the Chrome DevTools
  // protocol, since Playwright has no touch drag of its own).
  async function touchDrag(page: Page, from: { x: number; y: number }, getTo: () => Promise<{ x: number; y: number }>) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    await page.waitForTimeout(600);
    const to = await getTo();
    for (let i = 1; i <= 10; i++) {
      const point = { x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }

  test("press and hold picks a link up, and the folders come up to drop it on", async ({ page, signIn }) => {
    await signIn();
    await page.goto("/?list=folders");
    await newFolder(page, "Travel");
    await page.goto("/?list=all");
    await saveLink(page, "https://example.com/hold-me", "Hold me");
    const card = page.getByRole("list", { name: "Links" }).getByRole("listitem").filter({ hasText: "Hold me" });
    const panel = page.getByText("Drop on a folder").locator("..");

    const from = await spot(card.locator("p").first());
    await touchDrag(page, from, async () => {
      await expect(panel).toBeVisible();
      return spot(panel.getByText("Travel"));
    });

    await expect(page.getByText("Moved to Travel")).toBeVisible();
    await expect(panel).toHaveCount(0);
  });

  test("on the Folders screen, a folder held and slid above another goes before it", async ({ page, signIn }) => {
    await signIn();
    await page.goto("/?list=folders");
    await newFolder(page, "Work");
    await newFolder(page, "Travel");
    const tree = page.getByRole("list", { name: "All folders" });
    expect(await order(tree)).toEqual(["Work", "Travel"]);

    await touchDrag(page, await spot(tree.getByRole("button", { name: "Travel", exact: true })), () =>
      spot(tree.getByRole("button", { name: "Work", exact: true }), 0.1)
    );

    await expect(page.getByText('"Travel" moved up')).toBeVisible();
    await expect.poll(() => order(tree)).toEqual(["Travel", "Work"]);
  });
});

test("with the keyboard: Alt and the arrows move a folder, and Move up in its panel", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/?list=all");
  const folders = page.getByRole("list", { name: "Folders", exact: true });
  await newFolder(page, "Work");
  await newFolder(page, "Home");

  await folders.getByRole("button", { name: "Home", exact: true }).focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.getByText('"Home" moved up')).toBeVisible();
  // Still on Home, so the next key moves it again: into the folder above it is
  // none now, so Alt+↓ then Alt+→ puts it inside Work.
  await page.keyboard.press("Alt+ArrowDown");
  await page.keyboard.press("Alt+ArrowRight");
  await expect(page.getByText('"Home" moved to Work')).toBeVisible();

  await expect(async () => {
    await page.reload();
    await expect(folders.getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-description", "Inside Work", { timeout: 1000 });
  }).toPass();

  // The Edit folder panel does it without dragging too.
  await newFolder(page, "Ideas");
  await folders.getByRole("button", { name: "Ideas", exact: true }).click();
  await page.getByRole("button", { name: "Edit folder" }).click();
  await page.getByRole("button", { name: "Move up" }).click();
  await expect(page.getByText('"Ideas" moved up')).toBeVisible();
  await expect.poll(() => order(folders)).toEqual(["Ideas", "Work", "Home"]);
});
