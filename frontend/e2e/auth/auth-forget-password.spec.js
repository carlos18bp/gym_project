import { test, expect } from "../helpers/test.js";
import { installForgetPasswordApiMocks } from "../helpers/forgetPasswordMocks.js";

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

test("user can request password reset code and reset password", async ({ page }) => {
  await installForgetPasswordApiMocks(page, {
    sendPasscodeStatus: 200,
    resetStatus: 200,
  });

  await page.goto("/forget_password");

  // Fill email
  await page.locator("#email").fill("user@example.com");

  await bypassCaptcha(page);

  // Click send code button
  await page.getByRole("button", { name: "Enviar código" }).click();

  // Should show notification about code sent — dismiss it
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  const okBtn1 = page.locator(".swal2-confirm");
  if (await okBtn1.isVisible().catch(() => false)) {
    await okBtn1.click();
  } else {
    await page.evaluate(() => { if (window.Swal) window.Swal.close(); });
  }
  await expect(page.locator(".swal2-popup")).not.toBeVisible({ timeout: 5_000 });

  // Fill passcode and new password
  await page.locator("#passcode").fill("123456");
  await page.locator("#password").fill("NewSecurePass1!");
  await page.locator("#confirm_password").fill("NewSecurePass1!");

  // Submit the form via the submit button (type="submit")
  await page.locator('form button[type="submit"]').click();

  // Should show success notification
  await expect(page.locator(".swal2-popup")).toContainText("restablecida exitosamente", { timeout: 10_000 });

  // Should redirect to sign_in
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });
});

test("password reset with invalid passcode shows error", async ({ page }) => {
  await installForgetPasswordApiMocks(page, {
    sendPasscodeStatus: 200,
    resetStatus: 400,
    resetError: "Código inválido",
  });

  await page.goto("/forget_password");

  await page.locator("#email").fill("user@example.com");

  await bypassCaptcha(page);

  // Click send code
  await page.getByRole("button", { name: "Enviar código" }).click();

  // Dismiss notification
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  const okBtn2 = page.locator(".swal2-confirm");
  if (await okBtn2.isVisible().catch(() => false)) {
    await okBtn2.click();
  } else {
    await page.evaluate(() => { if (window.Swal) window.Swal.close(); });
  }
  await expect(page.locator(".swal2-popup")).not.toBeVisible({ timeout: 5_000 });

  // Fill wrong passcode and passwords
  await page.locator("#passcode").fill("999999");
  await page.locator("#password").fill("NewPass1!");
  await page.locator("#confirm_password").fill("NewPass1!");

  await page.locator('form button[type="submit"]').click();

  // Should show error notification
  await expect(page.locator(".swal2-popup")).toContainText("Código inválido", { timeout: 10_000 });

  // Should stay on forget_password page
  await expect(page).toHaveURL(/\/forget_password/);
});

test("forget password page has link back to sign in", async ({ page }) => {
  await installForgetPasswordApiMocks(page);

  await page.goto("/forget_password");

  const signInLink = page.getByRole("link", { name: "Iniciar sesión" });
  await expect(signInLink).toBeVisible();

  await signInLink.click();
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 10_000 });
});
