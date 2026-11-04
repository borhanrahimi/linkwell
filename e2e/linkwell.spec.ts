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
  await page.goto("/?list=all");

  await saveLink(page, "https://example.com/e2e", "My test link");
  await expect(page.getByRole("link", { name: "My test link" })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("link", { name: "My test link" })).toBeVisible();
});

test("users can't see each other's links", async ({ page, signIn }) => {
  await signIn("First");
  await page.goto("/?list=all");
  await saveLink(page, "https://example.com/private", "First's private link");
  await expect(
    page.getByRole("link", { name: "First's private link" })
  ).toBeVisible();

  await signIn("Second");
  await page.goto("/?list=all");

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
  await page.goto("/?list=all");

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
  await page.goto("/?list=all");
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
  await page.goto("/?list=all");
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
  await page.goto("/?list=all");
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
  // Home: the newest links are in Recently saved.
  await expect(page.getByRole("list", { name: "Recently saved" }).getByRole("link", { name: "Shared link" })).toBeVisible();
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
  await page.goto("/?list=all");

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
  await page.goto("/?list=all");
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
  await expect(page.getByRole("list", { name: "Recently saved" }).getByRole("link", { name: "Imported loose link" })).toBeVisible();
  await page.getByRole("navigation", { name: "Your lists" }).getByRole("button", { name: "Recipes" }).click();
  await expect(page.getByRole("link", { name: "Imported soup" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Imported loose link" })).toHaveCount(0);
});

test("checking links is rate limited: the sixth check in an hour is refused", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/?list=all");
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

  for (const path of ["/privacy", "/terms", "/demo"]) {
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
  await expect(page.getByRole("list", { name: "Recently saved" }).getByRole("link", { name: "Scripts still run" })).toBeVisible();
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

test("on a phone, the tab bar is always there: Folders shows only folders, and the account page has it too", async ({ page, signIn }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn();
  await page.goto("/?list=all");
  await saveLink(page, "https://example.com/phone-one", "Phone one");
  const bar = page.getByRole("navigation", { name: "Phone menu" });

  // No sidebar on a phone: Folders is a screen of its own, with only folders.
  await expect(page.getByRole("navigation", { name: "Your lists" })).toBeHidden();
  await bar.getByRole("button", { name: "Folders" }).click();
  await expect(page).toHaveURL(/\?list=folders$/);
  await expect(page.getByText("No folders yet.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "+ New folder" }).filter({ visible: true }).click();
  await page.getByRole("textbox", { name: "Folder name" }).filter({ visible: true }).fill("Travel");
  await page.getByRole("button", { name: "Create" }).filter({ visible: true }).click();
  await page.getByRole("list", { name: "All folders" }).getByRole("button", { name: "Travel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Travel" })).toBeVisible();
  await expect(bar).toBeVisible();

  // The account page keeps the bar, and its tabs lead back.
  await bar.getByRole("link", { name: "You" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await bar.getByRole("link", { name: "Unread" }).click();
  await expect(page.getByRole("heading", { name: "Unread" })).toBeVisible();
  await page.goto("/account");
  await bar.getByRole("link", { name: "Save a link" }).click();
  await expect(page.getByRole("dialog", { name: "Save a link" })).toBeVisible();
});

test("the chosen list lives in the address: back, refresh and bookmarks keep it", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/?list=all");
  await saveLink(page, "https://example.com/address-one", "Address one");
  await expect(page.getByRole("link", { name: "Address one" })).toBeVisible();
  await saveLink(page, "https://example.com/address-two", "Address two");
  await expect(page.getByRole("link", { name: "Address two" })).toBeVisible();
  // "Address two" is newest, so it's first: mark it as read.
  await page.getByRole("button", { name: "Mark read" }).first().click();
  await expect(page.getByRole("button", { name: "Mark unread" })).toBeVisible();

  const lists = page.getByRole("navigation", { name: "Your lists" });
  await lists.getByRole("button", { name: "Unread" }).click();
  await expect(page).toHaveURL(/\?list=unread$/);
  await expect(page.getByRole("link", { name: "Address two" })).toHaveCount(0);

  // A refresh (or a bookmark) opens the same list.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Unread" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Address two" })).toHaveCount(0);

  // Back goes to All links again.
  await page.goBack();
  await expect(page.getByRole("heading", { name: "All links" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Address two" })).toBeVisible();
});

test("saving from anywhere can make a folder on the spot and save into it, like a browser bookmark", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/share?url=" + encodeURIComponent("https://example.com/trip") + "&title=" + encodeURIComponent("Trip ideas"));

  await page.getByRole("combobox", { name: "Save to folder" }).selectOption({ label: "New folder…" });
  await page.getByRole("textbox", { name: "New folder name" }).fill("Travel");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("combobox", { name: "Save to folder" })).toHaveValue(/.+/);
  await page.getByRole("button", { name: "Save link" }).click();
  await expect(page.getByText("Saved to Linkwell in Travel.")).toBeVisible();

  // The next link offers the same folder, like a browser does.
  await page.goto("/share?url=" + encodeURIComponent("https://example.com/beach") + "&title=" + encodeURIComponent("Beaches"));
  await expect(page.getByRole("combobox", { name: "Save to folder" }).locator("option:checked")).toHaveText("Travel");
  await page.getByRole("button", { name: "Save link" }).click();
  await expect(page.getByText("Saved to Linkwell in Travel.")).toBeVisible();

  await page.goto("/?list=all");
  await page.getByRole("navigation", { name: "Your lists" }).getByRole("button", { name: "Travel" }).click();
  await expect(page.getByRole("link", { name: "Trip ideas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Beaches" })).toBeVisible();
});

test("the health check answers ok, for the uptime monitor", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("anyone can try the demo without an account, and nothing is saved", async ({ page }) => {
  // No server actions may run in the demo: record every POST the page makes.
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });

  await page.goto("/?list=all");
  await page.getByRole("link", { name: "Try the demo" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole("list", { name: "Recently saved" }).getByRole("link", { name: "Notes on CSS grid layouts" })).toBeVisible();
  await expect(page.getByRole("region", { name: /^Rediscover/ })).toBeVisible();

  await saveLink(page, "https://example.com/tried-the-demo", "Tried the demo");
  await expect(page.getByRole("list", { name: "Recently saved" }).getByRole("link", { name: "Tried the demo" })).toBeVisible();
  await page.getByRole("navigation", { name: "Your lists" }).getByRole("button", { name: "Recipes" }).click();
  await expect(page).toHaveURL(/\/demo\?folder=demo-recipes$/);
  expect(posts).toEqual([]);

  // A refresh starts over.
  await page.goto("/demo");
  await expect(page.getByRole("list", { name: "Recently saved" }).getByRole("link", { name: "Notes on CSS grid layouts" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tried the demo" })).toHaveCount(0);
});

test("a deleted link goes to the Trash: Undo brings it back, and so does Restore after a reload", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/?list=all");
  await saveLink(page, "https://example.com/trash-me", "Trash me");
  const links = page.getByRole("list", { name: "Links" });
  await expect(links.getByRole("link", { name: "Trash me" })).toBeVisible();

  // Delete shows on hover; Undo is in the message that follows.
  await links.getByRole("listitem").first().hover();
  await links.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Link moved to the Trash")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(links.getByRole("link", { name: "Trash me" })).toBeVisible();

  // Deleted again, it's in the Trash after a reload, and Restore puts it back.
  await links.getByRole("listitem").first().hover();
  await links.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("list", { name: "Links" })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Trash", exact: true }).filter({ visible: true }).click();
  await expect(page.getByText("30 days left")).toBeVisible();
  await page.getByRole("button", { name: "Restore Trash me" }).click();
  await page.getByRole("button", { name: "All links" }).filter({ visible: true }).click();
  await expect(page.getByRole("list", { name: "Links" }).getByRole("link", { name: "Trash me" })).toBeVisible();
});

test("folders go inside folders, and deleting one moves what's inside up a level", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/?list=all");
  const folders = page.getByRole("list", { name: "Folders", exact: true }).filter({ visible: true });

  await page.getByRole("button", { name: "+ New folder" }).filter({ visible: true }).click();
  await page.getByRole("textbox", { name: "Folder name" }).fill("Work");
  await page.getByRole("button", { name: "Create" }).click();
  await folders.getByRole("button", { name: "Work", exact: true }).click();
  await page.getByRole("button", { name: "Edit folder" }).click();
  await page.getByRole("textbox", { name: "New folder inside" }).fill("Clients");
  await page.getByRole("region", { name: "Edit folder" }).getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("list", { name: "Folders in Work" }).getByRole("button", { name: "Clients", exact: true })).toBeVisible();

  // Still there after a reload, inside Work.
  await page.reload();
  await folders.getByRole("button", { name: "Show folders in Work" }).click();
  await folders.getByRole("button", { name: "Clients", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Folder path" }).getByRole("button", { name: "Work", exact: true })).toBeVisible();

  // Deleting Work asks, then Clients moves up to the top level.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("navigation", { name: "Folder path" }).getByRole("button", { name: "Work", exact: true }).click();
  await page.getByRole("button", { name: "Edit folder" }).click();
  await page.getByRole("button", { name: "Delete folder" }).click();
  await expect(page.getByText('"Work" moved to the Trash')).toBeVisible();
  // The page shows the change at once; let the server finish before reloading.
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(folders.getByRole("button", { name: "Work", exact: true })).toHaveCount(0);
  await folders.getByRole("button", { name: "Clients", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Folder path" })).toHaveCount(0);
});

test("Home is the first screen: a few of everything, and the phone's tab bar gets around", async ({ page, signIn }) => {
  await signIn();
  await page.goto("/");
  await saveLink(page, "https://example.com/home-one", "Home one");
  await expect(page.getByRole("list", { name: "Recently saved" }).getByRole("link", { name: "Home one" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Unread links" }).getByRole("link", { name: "Home one" })).toBeVisible();
  await page.getByRole("button", { name: "See all links" }).click();
  await expect(page).toHaveURL(/\?list=all$/);
  await expect(page.getByRole("heading", { name: "All links" })).toBeVisible();

  // On a phone: Unread and Home in the bar, the Folders screen, You to the account.
  await page.setViewportSize({ width: 390, height: 844 });
  const bar = page.getByRole("navigation", { name: "Phone menu" });
  await bar.getByRole("button", { name: "Unread" }).click();
  await expect(page.getByRole("heading", { name: "Unread" })).toBeVisible();
  await bar.getByRole("button", { name: "Home" }).click();
  await expect(page.getByRole("list", { name: "Recently saved" })).toBeVisible();
  await bar.getByRole("button", { name: "Folders" }).click();
  await expect(page.getByText("No folders yet.", { exact: false })).toBeVisible();
  await bar.getByRole("link", { name: "You" }).click();
  await expect(page).toHaveURL(/\/account$/);
});
