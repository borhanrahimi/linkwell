import { expect, saveLink, test } from "./fixtures";

test("a signed-out visitor sees only the sign-in screen", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByPlaceholder("Paste a link...")).toHaveCount(0);
});

test("a signed-in user sees their name and can sign out", async ({ page, signIn }) => {
  await signIn("Ada Lovelace");
  await page.goto("/");

  await expect(page.getByText("Signed in as Ada Lovelace")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
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
  await expect(page.getByRole("link", { name: "First's private link" })).toBeVisible();

  await signIn("Second");
  await page.goto("/");

  await expect(page.getByText("Signed in as Second")).toBeVisible();
  await expect(page.getByRole("link", { name: "First's private link" })).toHaveCount(0);
});
