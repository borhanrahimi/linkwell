import { expect, saveLink, test } from "./fixtures";
import { measureContrast } from "./contrast";

// Run the same check with the system set to light and to dark mode.
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    // measureContrast injects a <style> tag to hide text while measuring; the
    // Content-Security-Policy rightly blocks that, so this test bypasses it.
    test.use({ colorScheme, bypassCSP: true });

    test("every text is readable (WCAG AA contrast)", async ({
      page,
      signIn,
    }) => {
      await signIn();
      await page.goto("/");
      await saveLink(page, "https://example.com/one", "A link");
      await saveLink(page, "https://example.com/two", "A read link");
      await page.getByRole("button", { name: "Mark read" }).first().click();
      // A note on one card, and the Edit form open on the other.
      await page.getByRole("button", { name: "Edit" }).first().click();
      await page.getByRole("textbox", { name: "Note" }).fill("Why I saved this");
      await page.getByRole("button", { name: "Save" }).nth(1).click();
      await page.getByText("Why I saved this").waitFor();
      // Two folder tabs.
      for (const name of ["Work", "Reading"]) {
        await page.getByRole("button", { name: "+ New folder" }).click();
        await page.getByRole("textbox", { name: "Folder name" }).fill(name);
        await page.getByRole("button", { name: "Create" }).click();
        await page.getByRole("button", { name, exact: true }).waitFor();
      }
      await page.getByRole("button", { name: "Edit" }).nth(1).click();

      const results = await measureContrast(page);
      // Then again with a folder's tab open (it shows only that folder's links).
      await page.getByRole("button", { name: "Work", exact: true }).click();
      await page.getByRole("button", { name: "Rename folder" }).waitFor();
      results.push(...(await measureContrast(page)));
      // And the List view, with its smaller rows.
      await page.getByRole("button", { name: "All links", exact: true }).click();
      await page.getByRole("button", { name: "List", exact: true }).click();
      results.push(...(await measureContrast(page)));
      // And the details panel of a link with a note.
      await page.getByRole("button", { name: "Details" }).last().click();
      await page.getByRole("button", { name: "Close", exact: true }).waitFor();
      results.push(...(await measureContrast(page)));
      // And on a phone, the Lists drawer over the dimmed page.
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Lists", exact: true }).click();
      await page.getByRole("navigation", { name: "Your lists" }).waitFor();
      results.push(...(await measureContrast(page)));
      const tooLow = results.filter((result) => result.ratio < result.needed);

      expect(results.length).toBeGreaterThan(10);
      expect(tooLow).toEqual([]);
    });

    test("every text on the landing page is readable", async ({ page }) => {
      await page.goto("/");
      // Open one answer, so its text is measured too.
      await page.getByText("Is it safe?").click();

      const results = await measureContrast(page);

      expect(results.length).toBeGreaterThan(20);
      expect(results.filter((result) => result.ratio < result.needed)).toEqual([]);
    });

    test("every text on the privacy and terms pages is readable", async ({ page }) => {
      for (const path of ["/privacy", "/terms"]) {
        await page.goto(path);
        const results = await measureContrast(page);
        expect(results.filter((result) => result.ratio < result.needed), path).toEqual([]);
      }
    });

    test("every text on the account page is readable", async ({
      page,
      signIn,
    }) => {
      await signIn();
      await page.goto("/account");
      await page.getByLabel("Username").fill("no spaces allowed");
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByText("Use only letters, numbers and _.").waitFor();
      await page.getByRole("button", { name: "Delete my account…" }).click();
      await page.getByLabel("Type delete to confirm").fill("delete");

      const results = await measureContrast(page);

      expect(results.filter((result) => result.ratio < result.needed)).toEqual(
        []
      );
    });
  });
}
