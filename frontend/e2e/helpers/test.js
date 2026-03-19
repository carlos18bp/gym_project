import { test as base, expect } from "@playwright/test";

const shouldLogErrors = process.env.E2E_LOG_ERRORS === "1";

export const test = base.extend({
  page: async ({ page }, use) => {
    // Block Google reCAPTCHA external scripts (iframes, error callbacks
    // interfere with Vue's event processing in CI environments).
    await page.route(
      /google\.com\/recaptcha|gstatic\.com\/recaptcha/,
      (route) => route.abort(),
    );

    // Fulfill (not abort) the Google Identity Services script so
    // vue3-google-login fires its "load" event, sets apiLoaded = true,
    // and uses our window.google stub below.  Aborting this request
    // caused an unhandled Promise rejection that crashed the page in CI.
    await page.route(
      /accounts\.google\.com\/gsi/,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: "/* gsi stub */",
        }),
    );

    // Provide a minimal grecaptcha stub so vue3-recaptcha2 finds it on mount
    // and calls renderRecaptcha() directly (no script tag, no Promise rejection).
    // The render() stub auto-fires the @verify callback after a microtask,
    // which sets captchaToken through Vue's normal event system.
    // Window-level flags let bypassCaptcha() detect completion without
    // walking Vue internals (which broke across Vue 3.5 reactivity rewrites).
    await page.addInitScript(() => {
      // ── Google Identity Services (GSI) stub ──
      // vue3-google-login calls google.accounts.id.initialize() and
      // renderButton() after the GSI script loads.  Provide no-op
      // implementations so the GoogleLogin component renders harmlessly.
      const gsiStub = {
        initialize() {},
        renderButton() {},
        prompt() {},
        disableAutoSelect() {},
        storeCredential() {},
        cancel() {},
        revoke(_hint, done) {
          if (typeof done === "function") done({ successful: true });
        },
      };
      Object.defineProperty(window, "google", {
        value: Object.freeze({ accounts: Object.freeze({ id: Object.freeze(gsiStub) }) }),
        writable: false,
        configurable: false,
      });

      // ── reCAPTCHA stub ──
      window.__e2eCaptchaVerified = false;
      window.__e2eCaptchaCallbacks = [];

      const stub = {
        render(_el, options) {
          if (options && typeof options.callback === "function") {
            window.__e2eCaptchaCallbacks.push(options.callback);
            Promise.resolve().then(() => {
              try {
                options.callback("e2e-captcha-token");
              } finally {
                window.__e2eCaptchaVerified = true;
              }
            });
          }
          return 0;
        },
        reset() {},
        execute() {},
        ready(cb) { if (typeof cb === "function") cb(); },
        getResponse() { return "e2e-captcha-token"; },
      };

      // Freeze the stub so no external script can overwrite it
      Object.defineProperty(window, "grecaptcha", {
        value: stub,
        writable: false,
        configurable: false,
      });
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
