import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : 4173;
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
const reuseExistingServer = process.env.E2E_REUSE_SERVER === "1" && !process.env.CI;
const isE2ECoverage = process.env.E2E_COVERAGE === "1";

export default defineConfig({
  testDir: "./e2e",
  timeout: isE2ECoverage ? 120_000 : 30_000,
  expect: {
    timeout: isE2ECoverage ? 15_000 : 5_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["json", { outputFile: "coverage-e2e/results.json" }],
  ],
  use: {
    baseURL,
    navigationTimeout: isE2ECoverage ? 60_000 : 30_000,
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
