import { expect, saveLink, test } from "./fixtures";
import { measureContrast } from "./contrast";

// Run the same check with the system set to light and to dark mode.
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test("every text is readable (WCAG AA contrast)", async ({ page, signIn }) => {
      await signIn();
      await page.goto("/");
      await saveLink(page, "https://example.com/one", "A link");
      await saveLink(page, "https://example.com/two", "A read link");
      await page.getByRole("button", { name: "Mark read" }).first().click();

      const results = await measureContrast(page);
      const tooLow = results.filter((result) => result.ratio < result.needed);

      expect(results.length).toBeGreaterThan(10);
      expect(tooLow).toEqual([]);
    });
  });
}
