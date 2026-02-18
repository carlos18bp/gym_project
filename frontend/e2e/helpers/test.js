import { test as base, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const isE2ECoverage = process.env.E2E_COVERAGE === "1";
const shouldLogErrors = process.env.E2E_LOG_ERRORS === "1";
const nycDir = path.join(process.cwd(), ".nyc_output");

function writeCoverageFile(coverageData) {
  fs.mkdirSync(nycDir, { recursive: true });
  const entropy = crypto.randomBytes(16).toString("hex");
  const filename = `coverage-${Date.now()}-${entropy}.json`;
  fs.writeFileSync(path.join(nycDir, filename), JSON.stringify(coverageData));
}

export const test = base.extend({
  page: async ({ page }, use) => {
    if (shouldLogErrors) {
      page.on("pageerror", (err) => {
        console.error("[e2e:pageerror]", err);
      });
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          console.error("[e2e:console:error]", msg.text());
        }
      });
    }

    await use(page);

    if (isE2ECoverage) {
      try {
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        await page.waitForTimeout(300).catch(() => {});

        let coverage = await page.evaluate(() => window.__coverage__).catch(() => null);
        if (!coverage) {
          await page.waitForTimeout(500).catch(() => {});
          coverage = await page.evaluate(() => window.__coverage__).catch(() => null);
        }

        if (coverage && typeof coverage === "object" && Object.keys(coverage).length > 0) {
          writeCoverageFile(coverage);
        }
      } catch (e) {
        // Page may already be closed — coverage lost for this test
      }
    }
  },
});

export { expect };
