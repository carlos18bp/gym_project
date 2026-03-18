import { test as base, expect } from "@playwright/test";

const shouldLogErrors = process.env.E2E_LOG_ERRORS === "1";

export const test = base.extend({
  page: async ({ page }, use) => {
    // Block Google reCAPTCHA external script from loading during E2E tests.
    // The real script causes DOM mutations (iframes, error callbacks) that
    // interfere with Vue's event processing in CI environments.
    // Tests bypass captcha via the bypassCaptcha() helper instead.
    await page.route(
      /google\.com\/recaptcha|gstatic\.com\/recaptcha/,
      (route) => route.abort(),
    );

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
  },
});

export { expect };
