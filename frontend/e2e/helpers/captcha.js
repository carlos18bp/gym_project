export async function bypassCaptcha(page, { rootSelector = "#email" } = {}) {
  // The grecaptcha stub (injected by the test fixture in test.js) auto-fires
  // the @verify callback when vue3-recaptcha2 calls grecaptcha.render().
  // The stub sets window.__e2eCaptchaVerified = true once the callback fires,
  // so we wait on that flag instead of walking Vue internals (which broke
  // across Vue 3.5 reactivity rewrites — see 6+ prior fix attempts in git log).
  await page.waitForFunction(
    () => window.__e2eCaptchaVerified === true,
    { timeout: 10_000 },
  );

  // DOM-level: force privacy-policy checkbox state + fire change event so
  // Vue's v-model directive picks it up (sign-on pages only; no-op on sign-in).
  await page.evaluate(() => {
    const cb = document.querySelector("#privacy-policy");
    if (cb && !cb.checked) {
      cb.checked = true;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}
