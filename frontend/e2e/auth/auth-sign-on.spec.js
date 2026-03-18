import { test, expect } from "../helpers/test.js";
import { installAuthSignOnApiMocks } from "../helpers/authSignOnMocks.js";
import { bypassCaptcha } from "../helpers/captcha.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

test("new user can register and is redirected to dashboard", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(60_000);
  const userId = 2000;

  await installAuthSignOnApiMocks(page, {
    userId,
    role: "client",
    signOnStatus: 200,
    passcode: "123456",
    verificationStatus: 200,
  });

  await page.goto("/sign_on");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida" })).toBeVisible({ timeout: 10_000 });

  await page.locator('[id="email"]').fill("newuser@example.com");
  await page.locator('[id="password"]').fill("SecurePass1!");
  await page.locator('[id="confirm_password"]').fill("SecurePass1!");
  await page.locator('[id="first_name"]').fill("New");
  await page.locator('[id="last_name"]').fill("User");

  // Accept privacy policy
  await page.locator('[id="privacy-policy"]').check();

  await bypassCaptcha(page);

  // Click register button
  const registerBtn = page.getByRole("button", { name: "Registrarse" });
  await expect(registerBtn).toBeEnabled({ timeout: 10_000 });
  await registerBtn.click();

  // Notification about verification code — dismiss it fully
  const notificationDialog = page.locator('[class~="swal2-popup"]');
  await expect(notificationDialog).toBeVisible({ timeout: 10_000 });
  const okBtn = page.locator('[class~="swal2-confirm"]');
  if (await okBtn.isVisible().catch(() => false)) {
    await okBtn.click();
  }
  await page.evaluate(() => {
    if (window.Swal) window.Swal.close();
    document.querySelectorAll('.swal2-container').forEach(el => el.remove());
    document.body.classList.remove('swal2-shown', 'swal2-height-auto');
    document.querySelectorAll('[aria-hidden]').forEach(el => el.removeAttribute('aria-hidden'));
  });

  // Wait for passcode input to appear (passcodeSent becomes truthy after API response)
  await expect(page.locator('[id="passcode"]')).toBeVisible({ timeout: 10_000 });

  // Enter the verification code
  await page.locator('[id="passcode"]').fill("123456");

  // Click verify button
  await page.getByRole("button", { name: "Verificar" }).click();

  // Wait for the success Swal to appear, then dismiss it to unblock navigation
  const successDialog = page.locator('[class~="swal2-popup"]');
  await expect(successDialog).toBeVisible({ timeout: 10_000 });
  const confirmBtn = page.locator('[class~="swal2-confirm"]');
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
  }
  await page.evaluate(() => {
    if (window.Swal) window.Swal.close();
    document.querySelectorAll('.swal2-container').forEach(el => el.remove());
    document.body.classList.remove('swal2-shown', 'swal2-height-auto');
    document.querySelectorAll('[aria-hidden]').forEach(el => el.removeAttribute('aria-hidden'));
  });

  // Should redirect to dashboard after successful sign on
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Token should be stored
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 10_000 })
    .toBe("e2e-access-token");
});

test("registration with mismatched passwords shows warning", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(60_000);
  const userId = 2001;

  await installAuthSignOnApiMocks(page, {
    userId,
    role: "client",
    signOnStatus: 200,
  });

  await page.goto("/sign_on");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida" })).toBeVisible({ timeout: 10_000 });

  await page.locator('[id="first_name"]').fill("Test");
  await page.locator('[id="last_name"]').fill("User");
  await page.locator('[id="email"]').fill("newuser@example.com");
  await page.locator('[id="password"]').fill("SecurePass1!");
  await page.locator('[id="confirm_password"]').fill("DifferentPass!");

  await page.locator('[id="privacy-policy"]').check();
  await bypassCaptcha(page);

  const registerBtn = page.getByRole("button", { name: "Registrarse" });
  await expect(registerBtn).toBeEnabled({ timeout: 10_000 });
  await registerBtn.click();

  // Should show password mismatch warning
  const mismatchDialog = page.locator('[class~="swal2-popup"]');
  await expect(mismatchDialog).toBeVisible({ timeout: 10_000 });
  await expect(mismatchDialog).toContainText("contraseñas no coinciden");

  // Should stay on sign_on page
  await expect(page).toHaveURL(/\/sign_on/);
});

test("registration with existing email shows error", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 2002;

  await installAuthSignOnApiMocks(page, {
    userId,
    role: "client",
    signOnStatus: 200,
    verificationStatus: 409,
  });

  await page.goto("/sign_on");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida" })).toBeVisible({ timeout: 10_000 });

  await page.locator('[id="email"]').fill("existing@example.com");
  await page.locator('[id="password"]').fill("SecurePass1!");
  await page.locator('[id="confirm_password"]').fill("SecurePass1!");
  await page.locator('[id="first_name"]').fill("Existing");
  await page.locator('[id="last_name"]').fill("User");

  await page.locator('[id="privacy-policy"]').check();
  await bypassCaptcha(page);

  const registerBtn = page.getByRole("button", { name: "Registrarse" });
  await expect(registerBtn).toBeEnabled({ timeout: 10_000 });
  await registerBtn.click();

  // Should show email already registered error
  await expect(page.locator('[class~="swal2-popup"]')).toContainText("ya está registrado", { timeout: 10_000 });

  // Should stay on sign_on page
  await expect(page).toHaveURL(/\/sign_on/);
});

test("sign on page has link to sign in", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 2003;

  await installAuthSignOnApiMocks(page, { userId, role: "client" });

  await page.goto("/sign_on");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida" })).toBeVisible({ timeout: 10_000 });

  const signInLink = page.getByRole("link", { name: "Iniciar sesión" });
  await expect(signInLink).toBeVisible();

  await signInLink.click();
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 10_000 });
});
