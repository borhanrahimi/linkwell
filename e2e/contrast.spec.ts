import { expect, saveLink, test } from "./fixtures";
import { measureContrast } from "./contrast";

// Run the same check with the system set to light and to dark mode.
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

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
      await page.getByRole("button", { name: "Edit" }).nth(1).click();

      const results = await measureContrast(page);
      const tooLow = results.filter((result) => result.ratio < result.needed);

      expect(results.length).toBeGreaterThan(10);
      expect(tooLow).toEqual([]);
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
