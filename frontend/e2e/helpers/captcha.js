export async function bypassCaptcha(page, { rootSelector = "#email" } = {}) {
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
      return;
    }

    // Otherwise set the ref value directly.
    if (tokenCandidate && typeof tokenCandidate === "object" && "value" in tokenCandidate) {
      tokenCandidate.value = "e2e-captcha-token";
      return;
    }

    // Fallback: try setting via proxy (works if it's exposed as a setter)
    if (comp.proxy && "captchaToken" in comp.proxy) {
      comp.proxy.captchaToken = "e2e-captcha-token";
      return;
    }

    throw new Error("Unable to bypass captcha: captchaToken is not writable");
  }, rootSelector);
}
