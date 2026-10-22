import { loadEnvConfig } from "@next/env";
import { test as base, type Page } from "@playwright/test";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { baseURL } from "../playwright.config";

loadEnvConfig(process.cwd());

// A second Better Auth instance, only for tests. It shares the app's secret and
// the test database, so the sessions it creates are real sessions the app accepts.
// That lets tests sign in without going through Google.
const testAuth = betterAuth({
  database: drizzleAdapter(drizzle(process.env.E2E_DATABASE_URL!), { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  plugins: [testUtils()],
});

type Fixtures = {
  // Signs a brand-new user in. Each test gets its own user, so tests can run
  // in parallel without seeing each other's links. The user (and, through
  // ON DELETE CASCADE, their links and folders) is deleted afterwards.
  signIn: (name?: string) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  signIn: async ({ context }, provide) => {
    const ctx = await testAuth.$context;
    const userIds: string[] = [];

    await provide(async (name = "Test User") => {
      const user = await ctx.test.saveUser(
        ctx.test.createUser({ name, email: `e2e-${crypto.randomUUID()}@example.com` })
      );
      userIds.push(user.id);
      await context.clearCookies();
      await context.addCookies(await ctx.test.getCookies({ userId: user.id, domain: "localhost" }));
    });

    for (const id of userIds) {
      await ctx.test.deleteUser(id);
    }
  },
});

export async function saveLink(page: Page, url: string, title: string) {
  // On phones the save box is in a sheet behind the bottom bar's +.
  const linkField = page.getByPlaceholder("Paste a link...").filter({ visible: true });
  if ((await linkField.count()) === 0) {
    await page.getByRole("button", { name: "Save a link" }).click();
  }
  await linkField.fill(url);
  // A typed title means the server doesn't fetch the page, so tests stay fast.
  await page.getByPlaceholder("Title (optional)").filter({ visible: true }).fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

export { expect } from "@playwright/test";
