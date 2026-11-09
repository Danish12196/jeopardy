import { defineConfig, devices } from "@playwright/test";

// Run through `npm run e2e`, which starts a throwaway local PocketBase
// (scripts/test-pb.mjs) and passes its URL in PB_URL / VITE_PB_URL.
const PB_URL = process.env.PB_URL;
if (!PB_URL) {
  throw new Error("PB_URL is not set. Run the E2E tests with `npm run e2e`.");
}

const PORT = Number(process.env.E2E_PORT || 5179);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    env: { VITE_PB_URL: PB_URL },
    timeout: 60_000,
  },
});
