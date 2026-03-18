import { test as base, expect } from "@playwright/test";

const shouldLogErrors = process.env.E2E_LOG_ERRORS === "1";

export const test = base.extend({
  page: async ({ page }, use) => {
    // Block Google reCAPTCHA external script from loading during E2E tests.
    // The real script causes DOM mutations (iframes, error callbacks) that
    // interfere with Vue's event processing in CI environments.
    await page.route(
      /google\.com\/recaptcha|gstatic\.com\/recaptcha/,
      (route) => route.abort(),
    );

    // Provide a minimal grecaptcha stub so vue3-recaptcha2 finds it on mount
    // and calls renderRecaptcha() directly (no script tag, no Promise rejection).
    // The render() stub auto-fires the @verify callback after a microtask,
    // which sets captchaToken through Vue's normal event system.
    await page.addInitScript(() => {
      window.grecaptcha = {
        render(_el, options) {
          if (options && typeof options.callback === "function") {
            Promise.resolve().then(() => options.callback("e2e-captcha-token"));
          }
          return 0;
        },
        reset() {},
        execute() {},
        ready(cb) { if (typeof cb === "function") cb(); },
      };
    });

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
