import { test, expect } from "../helpers/test.js";
import { installForgetPasswordApiMocks } from "../helpers/forgetPasswordMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

const alertDialog = (page) => page.getByRole("dialog");
const alertConfirmButton = (page) =>
  page.getByRole("button", { name: /^(ok|aceptar|confirmar|si|sí)$/i });

async function dismissSwalDialog(page) {
  const dialog = alertDialog(page);
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const confirmButton = alertConfirmButton(page);
  await confirmButton.click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  // quality: disable fragile_locator (SweetAlert2 library container — no testid/role available)
  await expect(page.locator('.swal2-container')).toBeHidden({ timeout: 5_000 });
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

test("user can request password reset code and reset password", { tag: ['@flow:auth-forgot-password', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(60_000);
  await installForgetPasswordApiMocks(page, {
    sendPasscodeStatus: 200,
    resetStatus: 200,
  });

  // Block external reCAPTCHA scripts to prevent page load from hanging
  await page.route('**google.com/recaptcha**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**gstatic.com/recaptcha**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));

  await page.goto("/forget_password", { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel(/correo|email/i)).toBeVisible({ timeout: 15_000 });

  // Fill email
  await page.getByLabel(/correo|email/i).fill("user@example.com");

  await bypassCaptcha(page);

  // Click send code button and wait for API response
  const sendCodeResponse = page.waitForResponse(resp => resp.url().includes("/api/send_passcode/"));
  await page.getByRole("button", { name: "Enviar código" }).click();
  await sendCodeResponse;

  // Should show notification about code sent — dismiss it
  await dismissSwalDialog(page);

  // Fill passcode and new password
  await page.getByLabel(/código|codigo|passcode/i).fill("123456");
  await page.getByLabel("Contraseña", { exact: true }).fill("NewSecurePass1!");
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill("NewSecurePass1!");

  // Re-bypass captcha in case VueRecaptcha widget expired the token
  await bypassCaptcha(page);

  // Submit the form and wait for the reset API response
  const resetResponse = page.waitForResponse(resp => resp.url().includes("/api/verify_passcode_and_reset_password/"));
  await page.getByRole("button", { name: /^Iniciar sesión$/i }).click();
  await resetResponse;

  // Should show success notification
  await expect(alertDialog(page)).toContainText("restablecida exitosamente", { timeout: 10_000 });

  // Should redirect to sign_in
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });
});

test("password reset with invalid passcode shows error", { tag: ['@flow:auth-forgot-password', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(60_000);
  await installForgetPasswordApiMocks(page, {
    sendPasscodeStatus: 200,
    resetStatus: 400,
    resetError: "Código inválido",
  });

  // Block external reCAPTCHA scripts to prevent page load from hanging
  await page.route('**google.com/recaptcha**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**gstatic.com/recaptcha**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));

  await page.goto("/forget_password", { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel(/correo|email/i)).toBeVisible({ timeout: 15_000 });

  await page.getByLabel(/correo|email/i).fill("user@example.com");

  await bypassCaptcha(page);

  // Click send code and wait for API response
  const sendCodeResponse = page.waitForResponse(resp => resp.url().includes("/api/send_passcode/"));
  await page.getByRole("button", { name: "Enviar código" }).click();
  await sendCodeResponse;

  // Dismiss notification
  await dismissSwalDialog(page);

  // Fill wrong passcode and passwords
  await page.getByLabel(/código|codigo|passcode/i).fill("999999");
  await page.getByLabel("Contraseña", { exact: true }).fill("NewPass1!");
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill("NewPass1!");

  // Re-bypass captcha in case VueRecaptcha widget expired the token
  await bypassCaptcha(page);

  // Submit the form and wait for the reset API response
  const resetResponse = page.waitForResponse(resp => resp.url().includes("/api/verify_passcode_and_reset_password/"));
  await page.getByRole("button", { name: /^Iniciar sesión$/i }).click();
  await resetResponse;

  // Should show error notification
  await expect(alertDialog(page)).toContainText("Código inválido", { timeout: 10_000 });

  // Should stay on forget_password page
  await expect(page).toHaveURL(/\/forget_password/);
});

test("forget password page has link back to sign in", { tag: ['@flow:auth-forgot-password', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  await installForgetPasswordApiMocks(page);

  // Block external reCAPTCHA scripts to prevent page load from hanging
  await page.route('**google.com/recaptcha**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await page.route('**gstatic.com/recaptcha**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));

  await page.goto("/forget_password", { waitUntil: 'domcontentloaded' });

  const signInLink = page.getByRole("link", { name: "Iniciar sesión" });
  await expect(signInLink).toBeVisible();

  await signInLink.click();
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 10_000 });
});
