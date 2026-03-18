export async function bypassCaptcha(page, { rootSelector = "#email" } = {}) {
  // Wait for Vue component tree to be ready with captchaToken before attempting bypass
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector) || document.querySelector("form");
      let comp = el && el.__vueParentComponent;
      while (comp) {
        if (
          (comp.setupState && "captchaToken" in comp.setupState) ||
          (comp.ctx && "captchaToken" in comp.ctx) ||
          (comp.proxy && "captchaToken" in comp.proxy)
        ) return true;
        comp = comp.parent;
      }
      return false;
    },
    rootSelector,
    { timeout: 10_000 },
  );

  await page.evaluate((selector) => {
    const el = document.querySelector(selector) || document.querySelector("form");
    let comp = el && el.__vueParentComponent;

    // Walk up the component tree until we find a component instance exposing captchaToken.
    while (
      comp &&
      !(
        (comp.setupState && "captchaToken" in comp.setupState) ||
        (comp.ctx && "captchaToken" in comp.ctx) ||
        (comp.proxy && "captchaToken" in comp.proxy)
      )
    ) {
      comp = comp.parent;
    }

    if (!comp) {
      throw new Error("Unable to bypass captcha: captchaToken not found");
    }

    const tokenCandidate =
      (comp.setupState && comp.setupState.captchaToken) ||
      (comp.ctx && comp.ctx.captchaToken) ||
      (comp.proxy && comp.proxy.captchaToken);

    // Prefer calling the handler if available
    const handler =
      (comp.setupState && comp.setupState.onCaptchaVerified) ||
      (comp.ctx && comp.ctx.onCaptchaVerified) ||
      (comp.proxy && comp.proxy.onCaptchaVerified);

    if (typeof handler === "function") {
      handler("e2e-captcha-token");
    } else if (tokenCandidate && typeof tokenCandidate === "object" && "value" in tokenCandidate) {
      // Set the ref value directly.
      tokenCandidate.value = "e2e-captcha-token";
    } else if (comp.proxy && "captchaToken" in comp.proxy) {
      // Fallback: try setting via proxy (works if it's exposed as a setter)
      comp.proxy.captchaToken = "e2e-captcha-token";
    } else {
      throw new Error("Unable to bypass captcha: captchaToken is not writable");
    }

    // Set privacyAccepted to true via Vue reactivity to avoid race
    // conditions between Playwright DOM interactions and Vue change-event
    // processing (the reCAPTCHA widget async load can interfere).
    // NOTE: Use 'in' operator for existence check, NOT the value itself,
    // because Vue 3.5's setupState proxy auto-unwraps refs (false → falsy)
    // which breaks the old value-based || chain.
    if (comp.setupState && "privacyAccepted" in comp.setupState) {
      comp.setupState.privacyAccepted = true;
    } else if (comp.proxy && "privacyAccepted" in comp.proxy) {
      comp.proxy.privacyAccepted = true;
    }

    // DOM-level fallback: force checkbox state + fire change event so
    // Vue's v-model picks it up even if the internal setter above was
    // silently ineffective in this Vue version.
    const cb = document.querySelector("#privacy-policy");
    if (cb) {
      cb.checked = true;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, rootSelector);
}
