export async function bypassCaptcha(page, { rootSelector = "#email" } = {}) {
  // The grecaptcha stub (injected by the test fixture in test.js) auto-fires
  // the @verify callback when vue3-recaptcha2 calls grecaptcha.render().
  // Wait for that callback to propagate captchaToken through Vue's reactivity.
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector) || document.querySelector("form");
      let comp = el && el.__vueParentComponent;
      while (comp) {
        // Use 'in' operator because Vue 3.5 proxyRefs auto-unwraps refs on read
        // (empty string → falsy), which would break value-based || chains.
        if (comp.setupState && "captchaToken" in comp.setupState) {
          // Check that the token is already set (by the grecaptcha stub callback)
          const raw = comp.setupState.__v_raw || comp.setupState;
          const ref = raw.captchaToken;
          if (ref && ref.value) return true;
          // Token ref exists but not yet set — keep polling
          return false;
        }
        comp = comp.parent;
      }
      return false;
    },
    rootSelector,
    { timeout: 10_000 },
  );

  // Set privacyAccepted via Vue internals + DOM fallback
  await page.evaluate((selector) => {
    const el = document.querySelector(selector) || document.querySelector("form");
    let comp = el && el.__vueParentComponent;

    while (
      comp &&
      !(comp.setupState && "captchaToken" in comp.setupState)
    ) {
      comp = comp.parent;
    }

    if (!comp) {
      throw new Error("bypassCaptcha: component with captchaToken not found");
    }

    // Set privacyAccepted through the proxyRefs proxy (Vue 3.5 setupState).
    if (comp.setupState && "privacyAccepted" in comp.setupState) {
      comp.setupState.privacyAccepted = true;
    }

    // DOM-level fallback: force checkbox state + fire change event so
    // Vue's v-model directive picks it up as a secondary guarantee.
    const cb = document.querySelector("#privacy-policy");
    if (cb && !cb.checked) {
      cb.checked = true;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, rootSelector);
}
