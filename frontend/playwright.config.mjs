import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : 4173;
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
const reuseExistingServer = process.env.E2E_REUSE_SERVER === "1" && !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,//process.env.CI ? 1 : 3,
  reporter: process.env.CI
    ? [
        ["blob"],
        ["junit", { outputFile: "test-results/e2e-results.xml" }],
      ]
    : [
        ["list"],
        ["html", { open: "never" }],
        ["json", { outputFile: "e2e-results/results.json" }],
        ["./e2e/reporters/flow-coverage-reporter.mjs", { outputDir: "e2e-results" }],
      ],
  use: {
    baseURL,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
    serviceWorkers: "block",
  },
  webServer: {
    command: process.env.CI
      ? `npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort --base / --outDir dist`
      : `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer,
    timeout: process.env.CI ? 60_000 : 120_000,
  },
  projects: [
    {
      name: "Desktop Chrome",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    /** 
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 5"],
      },
    },
    {
      name: "Tablet",
      use: {
        ...devices["iPad Mini"],
      },
    },
    */
  ],
});
