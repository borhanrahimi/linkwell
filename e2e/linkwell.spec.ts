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
