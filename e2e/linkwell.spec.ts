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

  // Still there after a reload: it was saved on the server. The card shows the
  // edit before the server has finished saving, so reload until it's there.
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("link", { name: "Edited" })).toBeVisible({ timeout: 1000 });
  }).toPass();
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

test("a user can import a bookmarks file, folders and all", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/account");

  const file = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
    <DT><H3>Recipes</H3>
    <DL><p>
        <DT><A HREF="https://example.com/soup" TAGS="food">Imported soup</A>
    </DL><p>
    <DT><A HREF="https://example.com/loose">Imported loose link</A>
</DL><p>`;
  await page.getByLabel("Choose bookmarks file").setInputFiles({
    name: "bookmarks.html",
    mimeType: "text/html",
    buffer: Buffer.from(file),
  });
  await expect(page.getByText("Found 2 links in 1 folder.")).toBeVisible();

  await page.getByRole("button", { name: "Import 2 links" }).click();
  await expect(page.getByText("Imported 2 links.")).toBeVisible();

  await page.getByRole("link", { name: "Go to my links" }).click();
  await expect(page.getByRole("link", { name: "Imported loose link" })).toBeVisible();
  await page.getByRole("button", { name: "Recipes" }).click();
  await expect(page.getByRole("link", { name: "Imported soup" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Imported loose link" })).toHaveCount(0);
});

test("checking links is rate limited: the sixth check in an hour is refused", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/");
  await saveLink(page, "https://gone.linkwell-test.invalid/", "Rate limit test");

  const button = page.getByRole("button", { name: "Check links" });
  for (let i = 0; i < 5; i++) {
    await button.click();
    await expect(page.getByText(/^Checked 1 link/)).toBeVisible();
    await expect(button).toBeEnabled();
  }
  await button.click();

  await expect(page.getByText("You're going a bit fast. Please wait a moment and try again.")).toBeVisible();
});

test("every page sends security headers, and nothing on it is blocked by them", async ({ page, signIn }) => {
  // Collect every Content-Security-Policy violation the browser reports.
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { cspViolations: string[] }).cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  const violations = () => page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);

  for (const path of ["/privacy", "/terms"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await violations(), path).toEqual([]);
  }

  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(await violations()).toEqual([]);

  await signIn();
  for (const path of ["/", "/account", "/share?url=https%3A%2F%2Fexample.com%2F"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await violations(), path).toEqual([]);
  }
  // The page still works: React's scripts ran (the save form responds).
  await page.goto("/");
  await saveLink(page, "https://example.com/csp", "Scripts still run");
  await expect(page.getByRole("link", { name: "Scripts still run" })).toBeVisible();
  expect(await violations()).toEqual([]);
});

test("the privacy and terms pages are linked from the landing page", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What Linkwell stores" })).toBeVisible();

  await page.getByRole("link", { name: "Terms", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
});

test("pages carry a title, a description and a sharing preview picture", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Linkwell");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Save links/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Linkwell");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");

  // The picture is announced with its size and description, and it loads.
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /Linkwell/);
  const response = await request.get(new URL(image!).pathname);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toBe("image/png");

  await page.goto("/privacy");
  await expect(page).toHaveTitle("Privacy · Linkwell");
});

test("on a phone, the lists open in a drawer and close once one is picked", async ({ page, signIn }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn();
  await page.goto("/");
  await saveLink(page, "https://example.com/phone-one", "Phone one");
  await saveLink(page, "https://example.com/phone-two", "Phone two");
  // The newest link comes first: "Phone two" is the one marked as read.
  await expect(page.getByRole("link", { name: "Phone two" })).toBeVisible();
  await page.getByRole("button", { name: "Mark read" }).first().click();
  await expect(page.getByRole("button", { name: "Mark unread" })).toBeVisible();
  const lists = page.getByRole("navigation", { name: "Your lists" });

  // The links come first; the sidebar waits behind the Lists button.
  await expect(lists).toBeHidden();
  await page.getByRole("button", { name: "Lists", exact: true }).click();
  await expect(lists).toBeVisible();

  await lists.getByRole("button", { name: "Unread" }).click();
  await expect(lists).toBeHidden();
  await expect(page.getByRole("heading", { name: "Unread" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Phone two" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Phone one" })).toBeVisible();

  // Esc closes it too.
  await page.getByRole("button", { name: "Lists", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(lists).toBeHidden();
});
