import { test, expect } from "../helpers/test.js";
import { installForgetPasswordApiMocks } from "../helpers/forgetPasswordMocks.js";

const alertDialog = (page) => page.getByRole("dialog");
const alertConfirmButton = (page) =>
  page.getByRole("button", { name: /^(ok|aceptar|confirmar|si|sí)$/i });

async function dismissAlertIfVisible(page, timeout = 10_000) {
  const confirmButton = alertConfirmButton(page);
  if (await confirmButton.isVisible({ timeout }).catch(() => false)) {
    await confirmButton.click();
  }
}

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
  await page.getByLabel(/correo|email/i).fill("user@example.com");

  await bypassCaptcha(page);

  // Click send code button
  await page.getByRole("button", { name: "Enviar código" }).click();

  // Should show notification about code sent — dismiss it
  await expect(alertDialog(page)).toBeVisible({ timeout: 10_000 });
  await dismissAlertIfVisible(page);
  await page.evaluate(() => {
    if (window.Swal) window.Swal.close();
    document.querySelectorAll('.swal2-container').forEach(el => el.remove());
    document.body.classList.remove('swal2-shown', 'swal2-height-auto');
    document.querySelectorAll('[aria-hidden]').forEach(el => el.removeAttribute('aria-hidden'));
  });

  // Fill passcode and new password
  await page.getByLabel(/código|codigo|passcode/i).fill("123456");
  await page.getByRole("textbox", { name: /^Contraseña$/i }).fill("NewSecurePass1!");
  await page.getByRole("textbox", { name: /^Confirmar contraseña$/i }).fill("NewSecurePass1!");

  // Submit the form via the submit button (type="submit")
  await page.getByRole("button", { name: /^Iniciar sesión$/i }).click();

  // Should show success notification
  await expect(alertDialog(page)).toContainText("restablecida exitosamente", { timeout: 10_000 });

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

  await page.getByLabel(/correo|email/i).fill("user@example.com");

  await bypassCaptcha(page);

  // Click send code
  await page.getByRole("button", { name: "Enviar código" }).click();

  // Dismiss notification
  await expect(alertDialog(page)).toBeVisible({ timeout: 10_000 });
  await dismissAlertIfVisible(page);
  await page.evaluate(() => {
    if (window.Swal) window.Swal.close();
    document.querySelectorAll('.swal2-container').forEach(el => el.remove());
    document.body.classList.remove('swal2-shown', 'swal2-height-auto');
    document.querySelectorAll('[aria-hidden]').forEach(el => el.removeAttribute('aria-hidden'));
  });

  // Fill wrong passcode and passwords
  await page.getByLabel(/código|codigo|passcode/i).fill("999999");
  await page.getByRole("textbox", { name: /^Contraseña$/i }).fill("NewPass1!");
  await page.getByRole("textbox", { name: /^Confirmar contraseña$/i }).fill("NewPass1!");

  await page.getByRole("button", { name: /^Iniciar sesión$/i }).click();

  // Should show error notification
  await expect(alertDialog(page)).toContainText("Código inválido", { timeout: 10_000 });

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
