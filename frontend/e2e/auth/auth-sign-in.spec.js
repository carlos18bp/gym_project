import { test, expect } from "../helpers/test.js";

import { installAuthSignInApiMocks } from "../helpers/authSignInMocks.js";

async function bypassCaptcha(page) {
  await page.evaluate(() => {
    const el = document.querySelector("#email") || document.querySelector("form");
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
  });
}

test("client can sign in and is redirected to dashboard", async ({ page }) => {
  const userId = 1000;

  await installAuthSignInApiMocks(page, {
    userId,
    role: "client",
    signInStatus: 200,
  });

  await page.goto("/sign_in");

  await page.locator("#email").fill("client@example.com");
  await page.locator("#password").fill("password");

  await bypassCaptcha(page);

  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 10_000 })
    .toBe("e2e-access-token");

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("client");
});

test("lawyer can sign in and is redirected to dashboard", async ({ page }) => {
  const userId = 1100;

  await installAuthSignInApiMocks(page, {
    userId,
    role: "lawyer",
    signInStatus: 200,
  });

  await page.goto("/sign_in");

  await page.locator("#email").fill("lawyer@example.com");
  await page.locator("#password").fill("password");

  await bypassCaptcha(page);

  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 10_000 })
    .toBe("e2e-access-token");

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("lawyer");
});

test("invalid credentials shows warning", async ({ page }) => {
  const userId = 1200;

  await installAuthSignInApiMocks(page, {
    userId,
    role: "client",
    signInStatus: 401,
  });

  await page.goto("/sign_in");

  await page.locator("#email").fill("client@example.com");
  await page.locator("#password").fill("wrong");

  await bypassCaptcha(page);

  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".swal2-popup")).toContainText("Credenciales inválidas");

  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
});
