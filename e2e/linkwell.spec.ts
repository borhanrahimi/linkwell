import { expect, saveLink, test } from "./fixtures";
import { readFile } from "node:fs/promises";

test("a signed-out visitor sees only the sign-in screen", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();
  await expect(page.getByPlaceholder("Paste a link...")).toHaveCount(0);
});

test("a signed-in user sees their name and can sign out", async ({
  page,
  signIn,
}) => {
  await signIn("Ada Lovelace");
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Ada Lovelace" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(
    page.getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();
});

test("a saved link is still there after a reload", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/");

  await saveLink(page, "https://example.com/e2e", "My test link");
  await expect(page.getByRole("link", { name: "My test link" })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("link", { name: "My test link" })).toBeVisible();
});

test("users can't see each other's links", async ({ page, signIn }) => {
  await signIn("First");
  await page.goto("/");
  await saveLink(page, "https://example.com/private", "First's private link");
  await expect(
    page.getByRole("link", { name: "First's private link" })
  ).toBeVisible();

  await signIn("Second");
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Second" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "First's private link" })
  ).toHaveCount(0);
});

test("a user can choose a username on the account page", async ({
  page,
  signIn,
}) => {
  // Usernames are unique across Linkwell, so each run picks a new one.
  const username = `ada_${Date.now().toString(36)}`;
  await signIn("Ada Lovelace");
  await page.goto("/");

  await page.getByRole("link", { name: "Ada Lovelace" }).click();
  await expect(
    page.getByRole("heading", { name: "Ada Lovelace" })
  ).toBeVisible();

  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("status")).toHaveText(
    `Saved. You're @${username} now.`
  );
  await expect(page.getByRole("link", { name: `@${username}` })).toBeVisible();
});

test("the account page sends signed-out visitors to the sign-in screen", async ({
  page,
}) => {
  await page.goto("/account");

  await expect(
    page.getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();
});

test("a user can download their links as a bookmarks file", async ({
  page,
  signIn,
}) => {
  await signIn();
  await page.goto("/");
  await saveLink(page, "https://example.com/export-me", "Export me");
  await expect(page.getByRole("link", { name: "Export me" })).toBeVisible();

  await page.goto("/account");
  const downloadStarted = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download bookmarks file" }).click();
  const download = await downloadStarted;

  expect(download.suggestedFilename()).toMatch(
    /^linkwell-bookmarks-\d{4}-\d{2}-\d{2}\.html$/
  );
  const file = await readFile(await download.path());
  expect(file.toString()).toContain('<A HREF="https://example.com/export-me"');
});

test("a user can delete their account, and their links go with it", async ({
  page,
  signIn,
}) => {
  await signIn("Leaving User");
  await page.goto("/");
  await saveLink(page, "https://example.com/goodbye", "Goodbye link");
  await expect(page.getByRole("link", { name: "Goodbye link" })).toBeVisible();

  await page.goto("/account");
  await page.getByRole("button", { name: "Delete my account…" }).click();
  await page.getByLabel("Type delete to confirm").fill("delete");
  await page.getByRole("button", { name: "Delete forever" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "Your account and all your links were deleted. Goodbye"
  );
  await expect(
    page.getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();

  // The session is gone too: the account page now sends us back to sign in.
  await page.goto("/account");
  await expect(
    page.getByRole("button", { name: "Sign in with Google" })
  ).toBeVisible();
});

test("a user can edit a link's title, tags and note", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/");
  await saveLink(page, "https://example.com/edit-me", "Edit me");

  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Edited");
  await page.getByRole("textbox", { name: "Tags", exact: true }).fill("react, Docs");
  await page.getByRole("textbox", { name: "Note" }).fill("For the interview");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect(page.getByText("For the interview")).toBeVisible();

  // Still there after a reload: it was saved on the server.
  await page.reload();
  await expect(page.getByRole("link", { name: "Edited" })).toBeVisible();
  await expect(page.getByRole("button", { name: "#docs" })).toBeVisible();
  await expect(page.getByText("For the interview")).toBeVisible();
});

test("a link sent to /share is saved after one click", async ({ page, signIn }) => {
  await signIn();
  await page.goto(
    "/share?text=" + encodeURIComponent("Read this https://example.com/shared later")
  );

  await page.getByLabel("Title", { exact: true }).fill("Shared link");
  await page.getByRole("button", { name: "Save link" }).click();
  await expect(page.getByText("Saved to Linkwell.")).toBeVisible();

  await page.getByRole("link", { name: "Go to my links" }).click();
  await expect(page.getByRole("link", { name: "Shared link" })).toBeVisible();
});

test("/share asks a signed-out visitor to sign in first", async ({ page }) => {
  await page.goto("/share?url=" + encodeURIComponent("https://example.com/x"));

  await expect(page.getByText("Sign in to save https://example.com/x")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save link" })).toHaveCount(0);
});

test("the bookmarklet opens /share for the page it's clicked on", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/account");

  const button = page.getByRole("link", { name: "Save to Linkwell" });
  await expect(button).toHaveAttribute("href", /^javascript:/);
  const code = (await button.getAttribute("href"))!.replace(/^javascript:/, "");

  // Run it like the browser does when you click the bookmark.
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.evaluate((body) => new Function(body)(), code),
  ]);

  await expect(popup.getByRole("heading", { name: "Save to Linkwell" })).toBeVisible();
  await expect(popup.getByLabel("Title", { exact: true })).toHaveValue("Your account · Linkwell");
});

test("the app can be installed: the page links to a manifest with a share target", async ({ page }) => {
  await page.goto("/");

  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const response = await page.request.get(href!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.share_target.action).toBe("/share");

  for (const icon of manifest.icons) {
    expect((await page.request.get(icon.src)).ok()).toBe(true);
  }
});

test("Android's share format (link inside text) opens the save card", async ({ page, signIn }) => {
  await signIn();
  await page.goto(
    "/share?title=" + encodeURIComponent("A video") +
      "&text=" + encodeURIComponent("Watch this! https://example.com/video")
  );

  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("A video");
  await expect(page.getByText("example.com")).toBeVisible();
});

test("the Paste button fills in a copied link", async ({ page, context, signIn }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn();
  await page.goto("/");
  await page.evaluate(() => navigator.clipboard.writeText("https://example.com/copied"));

  await page.getByRole("button", { name: "Paste" }).click();

  await expect(page.getByPlaceholder("Paste a link...")).toHaveValue("https://example.com/copied");
});
