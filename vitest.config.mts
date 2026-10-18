import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    // e2e/ holds Playwright browser tests, run with `npm run e2e`.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
