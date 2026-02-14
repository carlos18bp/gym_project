import { test, expect } from "../helpers/test.js";
import { installAuthSignOnApiMocks } from "../helpers/authSignOnMocks.js";

async function bypassCaptcha(page) {
  await page.evaluate(() => {
    const el = document.querySelector("#email") || document.querySelector("form");
    let comp = el && el.__vueParentComponent;

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

    const handler =
      (comp.setupState && comp.setupState.onCaptchaVerified) ||
      (comp.ctx && comp.ctx.onCaptchaVerified) ||
      (comp.proxy && comp.proxy.onCaptchaVerified);

    if (typeof handler === "function") {
      handler("e2e-captcha-token");
      return;
    }

    const tokenCandidate =
      (comp.setupState && comp.setupState.captchaToken) ||
      (comp.ctx && comp.ctx.captchaToken) ||
      (comp.proxy && comp.proxy.captchaToken);

    if (tokenCandidate && typeof tokenCandidate === "object" && "value" in tokenCandidate) {
      tokenCandidate.value = "e2e-captcha-token";
      return;
    }

    throw new Error("Unable to bypass captcha: captchaToken is not writable");
  });
}

test("new user can register and is redirected to dashboard", async ({ page }) => {
  const userId = 2000;

  await installAuthSignOnApiMocks(page, {
    userId,
    role: "client",
    signOnStatus: 200,
    passcode: "123456",
    verificationStatus: 200,
  });

  await page.goto("/sign_on");

  await page.locator("#email").fill("newuser@example.com");
  await page.locator("#password").fill("SecurePass1!");
  await page.locator("#confirm_password").fill("SecurePass1!");
  await page.locator("#first_name").fill("New");
  await page.locator("#last_name").fill("User");

  // Accept privacy policy
  await page.locator("#privacy-policy").check();

  await bypassCaptcha(page);

  // Click register button
  await page.getByRole("button", { name: "Registrarse" }).click();

  // Notification about verification code — dismiss it via OK button
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  const okBtn = page.locator(".swal2-confirm");
  if (await okBtn.isVisible().catch(() => false)) {
    await okBtn.click();
  } else {
    await page.evaluate(() => { if (window.Swal) window.Swal.close(); });
  }
  await expect(page.locator(".swal2-popup")).not.toBeVisible({ timeout: 5_000 });

  // Wait for passcode input to appear (passcodeSent becomes truthy after API response)
  await expect(page.locator("#passcode")).toBeVisible({ timeout: 10_000 });

  // Enter the verification code
  await page.locator("#passcode").fill("123456");

  // Click verify button
  await page.getByRole("button", { name: "Verificar" }).click();

  // Should redirect to dashboard after successful sign on
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Token should be stored
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 10_000 })
    .toBe("e2e-access-token");
});

test("registration with mismatched passwords shows warning", async ({ page }) => {
  const userId = 2001;

  await installAuthSignOnApiMocks(page, {
    userId,
    role: "client",
    signOnStatus: 200,
  });

  await page.goto("/sign_on");

  await page.locator("#first_name").fill("Test");
  await page.locator("#last_name").fill("User");
  await page.locator("#email").fill("newuser@example.com");
  await page.locator("#password").fill("SecurePass1!");
  await page.locator("#confirm_password").fill("DifferentPass!");

  await page.locator("#privacy-policy").check();
  await bypassCaptcha(page);

  await page.getByRole("button", { name: "Registrarse" }).click();

  // Should show password mismatch warning
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".swal2-popup")).toContainText("contraseñas no coinciden");

  // Should stay on sign_on page
  await expect(page).toHaveURL(/\/sign_on/);
});

test("registration with existing email shows error", async ({ page }) => {
  const userId = 2002;

  await installAuthSignOnApiMocks(page, {
    userId,
    role: "client",
    signOnStatus: 200,
    verificationStatus: 409,
  });

  await page.goto("/sign_on");

  await page.locator("#email").fill("existing@example.com");
  await page.locator("#password").fill("SecurePass1!");
  await page.locator("#confirm_password").fill("SecurePass1!");
  await page.locator("#first_name").fill("Existing");
  await page.locator("#last_name").fill("User");

  await page.locator("#privacy-policy").check();
  await bypassCaptcha(page);

  await page.getByRole("button", { name: "Registrarse" }).click();

  // Should show email already registered error
  await expect(page.locator(".swal2-popup")).toContainText("ya está registrado", { timeout: 10_000 });

  // Should stay on sign_on page
  await expect(page).toHaveURL(/\/sign_on/);
});

test("sign on page has link to sign in", async ({ page }) => {
  const userId = 2003;

  await installAuthSignOnApiMocks(page, { userId, role: "client" });

  await page.goto("/sign_on");

  const signInLink = page.getByRole("link", { name: "Iniciar sesión" });
  await expect(signInLink).toBeVisible();

  await signInLink.click();
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 10_000 });
});
