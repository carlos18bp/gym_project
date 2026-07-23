import { test, expect } from "../helpers/test.js";
import { installAuthSignOnApiMocks } from "../helpers/authSignOnMocks.js";
import { bypassCaptcha } from "../helpers/captcha.js";

/**
 * Branch coverage tests for auth-register flow.
 * Tests validation errors, duplicate email, and edge cases by driving
 * the real registration form and asserting the resulting notifications.
 */

async function fillRegistrationForm(page, { email = "branch-user@example.com" } = {}) {
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida" })).toBeVisible({ timeout: 15_000 });

  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="first_name"]').fill("Branch");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="last_name"]').fill("Tester");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="email"]').fill(email);
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="password"]').fill("SecurePass1!");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="confirm_password"]').fill("SecurePass1!");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="privacy-policy"]').check();

  await bypassCaptcha(page);
}

async function submitRegistration(page) {
  const registerBtn = page.getByRole("button", { name: "Registrarse" });
  await expect(registerBtn).toBeEnabled({ timeout: 10_000 });
  await registerBtn.click();
}

async function dismissNotification(page, expectedText) {
  const popup = page.locator('[class~="swal2-popup"]');
  await expect(popup).toBeVisible({ timeout: 10_000 });
  await expect(popup).toContainText(expectedText);
  const okBtn = page.locator('[class~="swal2-confirm"]');
  await expect(okBtn).toBeVisible();
  await okBtn.click();
  await page.evaluate(() => {
    if (window.Swal) window.Swal.close();
    document.querySelectorAll(".swal2-container").forEach((el) => el.remove());
    document.body.classList.remove("swal2-shown", "swal2-height-auto");
    document.querySelectorAll("[aria-hidden]").forEach((el) => el.removeAttribute("aria-hidden"));
  });
}

test("registration form shows validation error on bad sign-on request", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(60_000);

  await installAuthSignOnApiMocks(page, {
    userId: 9100,
    signOnStatus: 400,
  });

  await page.goto("/sign_on");
  await fillRegistrationForm(page);
  await submitRegistration(page);

  // Verification code was sent successfully; dismiss the info notification
  await dismissNotification(page, "código de acceso");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator('[id="passcode"]')).toBeVisible({ timeout: 10_000 });
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="passcode"]').fill("123456");
  await page.getByRole("button", { name: "Verificar" }).click();

  // The 400 from sign_on/ surfaces the backend error in a notification
  await expect(page.locator('[class~="swal2-popup"]')).toContainText("invalid_passcode", { timeout: 10_000 });

  // Registration failed: user stays on sign_on and no token is stored
  await expect(page).toHaveURL(/\/sign_on/);
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
});

test("registration form shows error when verification code fails", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(60_000);

  await installAuthSignOnApiMocks(page, {
    userId: 9101,
    verificationStatus: 400,
  });

  await page.goto("/sign_on");
  await fillRegistrationForm(page);
  await submitRegistration(page);

  // The failed send_verification_code surfaces the backend error message
  await dismissNotification(page, "email_exists");

  // The passcode step never unlocks and the user stays on sign_on
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator('[id="passcode"]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/sign_on/);
});

test("registration page renders with all form fields", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  await installAuthSignOnApiMocks(page, {
    userId: 9102,
  });

  await page.goto("/sign_on");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida" })).toBeVisible({ timeout: 15_000 });

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator('[id="first_name"]')).toBeVisible();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator('[id="last_name"]')).toBeVisible();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator('[id="email"]')).toBeVisible();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator('[id="password"]')).toBeVisible();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator('[id="confirm_password"]')).toBeVisible();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator('[id="privacy-policy"]')).toBeVisible();

  await expect(page.getByRole("button", { name: "Registrarse" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
});

test("registration with server error shows error notification", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(60_000);

  await installAuthSignOnApiMocks(page, {
    userId: 9103,
    signOnStatus: 500,
  });

  await page.goto("/sign_on");
  await fillRegistrationForm(page);
  await submitRegistration(page);

  await dismissNotification(page, "código de acceso");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator('[id="passcode"]')).toBeVisible({ timeout: 10_000 });
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="passcode"]').fill("123456");
  await page.getByRole("button", { name: "Verificar" }).click();

  // The 500 from sign_on/ surfaces its error payload in a notification
  await expect(page.locator('[class~="swal2-popup"]')).toContainText("invalid_passcode", { timeout: 10_000 });

  // Registration failed: user stays on sign_on and no token is stored
  await expect(page).toHaveURL(/\/sign_on/);
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
});
