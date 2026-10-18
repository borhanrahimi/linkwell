import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

loadEnvConfig(process.cwd());

// Browser tests run against their own server on port 3100 and their own
// database (a Neon branch), so they never touch your real links.
const port = 3100;
export const baseURL = `http://localhost:${port}`;

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "E2E_DATABASE_URL is not set. Add a Neon branch's connection string to .env.local."
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: baseURL,
    },
  },
});
