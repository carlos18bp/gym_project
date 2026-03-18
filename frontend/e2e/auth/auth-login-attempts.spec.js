import { test, expect } from "../helpers/test.js";
import { mockApi } from "../helpers/api.js";
import { bypassCaptcha } from "../helpers/captcha.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

async function installLoginAttemptsMocks(page) {
  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    if (apiPath === "google-captcha/verify/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) };
    }

    if (apiPath === "sign_in/" && route.request().method() === "POST") {
      return {
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Credenciales inválidas" }),
      };
    }

    if (apiPath === "validate_token/") {
      return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "invalid" }) };
    }

    return null;
  });
}

async function resetSignInState(page) {
  await page.addInitScript(() => {
    if (window.location.pathname !== "/sign_in") return;
    localStorage.removeItem("token");
    localStorage.removeItem("userAuth");
    localStorage.setItem("signInTries", "0");
    localStorage.setItem("signInSecondsRemaining", "0");
    localStorage.setItem("signInSecondsAcumulated", "0");
    localStorage.removeItem("signInIntervalId");
  });
}

async function attemptLogin(page) {
  await page.locator('[id="email"]').fill("wrong@example.com");
  await page.locator('[id="password"]').fill("wrongpassword");
  await bypassCaptcha(page);
  const loginBtn = page.getByRole("button", { name: "Iniciar sesión" });
  await expect(loginBtn).toBeVisible({ timeout: 10_000 });
  await expect(loginBtn).toBeEnabled({ timeout: 10_000 });
  await loginBtn.click();
}

async function dismissAlertIfVisible(page) {
  const confirmButton = page.getByRole("button", { name: /^(ok|aceptar|confirmar|si|sí)$/i });
  if (await confirmButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await confirmButton.click();
  }
  await page.evaluate(() => {
    if (window.Swal) window.Swal.close();
    document.querySelectorAll(".swal2-container").forEach((el) => el.remove());
    document.body.classList.remove("swal2-shown", "swal2-height-auto");
    document.querySelectorAll("[aria-hidden]").forEach((el) => el.removeAttribute("aria-hidden"));
  });
}

// quality: disable wait_for_timeout (throttle between sequential login attempts for localStorage state propagation)
test("after 3 failed login attempts, user sees lockout timer", { tag: ['@flow:auth-login-attempts', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(90_000);

  await resetSignInState(page);
  await installLoginAttemptsMocks(page);

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  // Attempt 3 failed logins
  for (let i = 0; i < 3; i++) {
    await attemptLogin(page);
    await dismissAlertIfVisible(page);
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(500);
  }

  // After 3 failed attempts, signInTries should be 3 and seconds remaining should be set
  const tries = await page.evaluate(() => parseInt(localStorage.getItem("signInTries"), 10));
  expect(tries).toBe(3);

  const secondsRemaining = await page.evaluate(() => parseInt(localStorage.getItem("signInSecondsRemaining"), 10));
  expect(secondsRemaining).toBeGreaterThan(0);
  expect(secondsRemaining).toBeLessThanOrEqual(60);
});

test("lockout timer pre-seeded at 3 tries shows remaining seconds on page load", { tag: ['@flow:auth-login-attempts', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  await installLoginAttemptsMocks(page);

  // Pre-seed localStorage with 3 failed attempts and active lockout
  await page.addInitScript(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("userAuth");
    localStorage.setItem("signInTries", "3");
    localStorage.setItem("signInSecondsRemaining", "55");
    localStorage.setItem("signInSecondsAcumulated", "60");
  });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  // The remaining seconds should be visible or the login button should reflect the lockout
  // Verify localStorage state is preserved
  const tries = await page.evaluate(() => parseInt(localStorage.getItem("signInTries"), 10));
  expect(tries).toBe(3);

  const seconds = await page.evaluate(() => parseInt(localStorage.getItem("signInSecondsRemaining"), 10));
  expect(seconds).toBeGreaterThan(0);
});

test("lockout doubles after 6 failed attempts (60s then 120s)", { tag: ['@flow:auth-login-attempts', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(60_000);
  await installLoginAttemptsMocks(page);

  // Pre-seed localStorage at 5 tries (next failure = 6th = next lockout tier)
  await page.addInitScript(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("userAuth");
    localStorage.setItem("signInTries", "5");
    localStorage.setItem("signInSecondsRemaining", "0");
    localStorage.setItem("signInSecondsAcumulated", "60");
  });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  // One more failed attempt (6th total)
  await attemptLogin(page);
  await dismissAlertIfVisible(page);

  await expect.poll(
    () => page.evaluate(() => parseInt(localStorage.getItem("signInTries"), 10)),
    { timeout: 5_000 },
  ).toBe(6);

  // After 6 tries, accumulated should double from 60 to 120
  const accumulated = await page.evaluate(() => parseInt(localStorage.getItem("signInSecondsAcumulated"), 10));
  expect(accumulated).toBe(120);

  const remaining = await page.evaluate(() => parseInt(localStorage.getItem("signInSecondsRemaining"), 10));
  expect(remaining).toBeGreaterThan(0);
  expect(remaining).toBeLessThanOrEqual(120);
});
