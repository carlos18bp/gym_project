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

async function seedSignInState(page, { tries = 0, secondsRemaining = 0, secondsAcumulated = 0 } = {}) {
  await page.addInitScript(
    ({ tries: t, secondsRemaining: r, secondsAcumulated: a }) => {
      localStorage.removeItem("token");
      localStorage.removeItem("userAuth");
      localStorage.setItem("signInTries", String(t));
      localStorage.setItem("signInSecondsRemaining", String(r));
      localStorage.setItem("signInSecondsAcumulated", String(a));
      localStorage.removeItem("signInIntervalId");
    },
    { tries, secondsRemaining, secondsAcumulated }
  );
}

async function dismissAttemptAlert(page) {
  // Every failed attempt surfaces a SweetAlert: either the invalid-credentials
  // warning or the lockout warning (every 3rd try). Its absence is a bug.
  // quality: allow-fragile-selector (SweetAlert2 popup, precedent in suite)
  const popup = page.locator('[class~="swal2-popup"]');
  await expect(popup).toBeVisible({ timeout: 10_000 });
  const confirmButton = page.getByRole("button", { name: /^(ok|aceptar|confirmar|si|sí)$/i });
  await expect(confirmButton).toBeVisible();
  await confirmButton.click();
  await page.evaluate(() => {
    if (window.Swal) window.Swal.close();
    document.querySelectorAll(".swal2-container").forEach((el) => el.remove());
    document.body.classList.remove("swal2-shown", "swal2-height-auto");
    document.querySelectorAll("[aria-hidden]").forEach((el) => el.removeAttribute("aria-hidden"));
  });
}

async function failLoginAttempt(page, expectedTries) {
  const loginBtn = page.getByRole("button", { name: "Iniciar sesión" });
  await expect(loginBtn).toBeEnabled({ timeout: 15_000 });
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="email"]').fill("wrong@example.com");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="password"]').fill("wrongpassword");
  await bypassCaptcha(page);
  await loginBtn.click();
  await dismissAttemptAlert(page);
  await expect
    .poll(() => page.evaluate(() => parseInt(localStorage.getItem("signInTries"), 10)), { timeout: 10_000 })
    .toBe(expectedTries);
}

test("after 3 failed login attempts, user sees lockout timer", { tag: ['@flow:auth-login-attempts', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(90_000);

  await seedSignInState(page);
  await installLoginAttemptsMocks(page);

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  // Two rejected attempts leave the form usable
  await failLoginAttempt(page, 1);
  await failLoginAttempt(page, 2);
  await expect(page.getByText(/Intentar de nuevo en/)).toBeHidden();

  // The third rejection is the one that locks the form
  const loginBtn = page.getByRole("button", { name: "Iniciar sesión" });
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="email"]').fill("wrong@example.com");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="password"]').fill("wrongpassword");
  await bypassCaptcha(page);
  await loginBtn.click();
  await dismissAttemptAlert(page);

  // The countdown is now on screen and the submit button is locked
  await expect(page.getByText(/Intentar de nuevo en/)).toBeVisible({ timeout: 10_000 });
  await expect(loginBtn).toBeDisabled();

  const secondsRemaining = await page.evaluate(() => parseInt(localStorage.getItem("signInSecondsRemaining"), 10));
  expect(secondsRemaining).toBeLessThanOrEqual(60);
});

test("user can submit again once the lockout countdown runs out", { tag: ['@flow:auth-login-attempts', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  await installLoginAttemptsMocks(page);

  // Land on the page mid-lockout: 3 failures, 2 seconds left on the timer
  await seedSignInState(page, { tries: 3, secondsRemaining: 2, secondsAcumulated: 60 });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  const loginBtn = page.getByRole("button", { name: "Iniciar sesión" });
  await expect(page.getByText(/Intentar de nuevo en/)).toBeVisible();
  await expect(loginBtn).toBeDisabled();

  // Once the countdown drains, the form accepts a new submission
  await expect(loginBtn).toBeEnabled({ timeout: 15_000 });
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="email"]').fill("wrong@example.com");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="password"]').fill("wrongpassword");
  await bypassCaptcha(page);

  const signInRequest = page.waitForRequest(
    (request) => request.url().includes("/api/sign_in/") && request.method() === "POST"
  );
  await loginBtn.click();

  expect((await signInRequest).postDataJSON().email).toBe("wrong@example.com");
  // quality: allow-fragile-selector (SweetAlert2 popup, precedent in suite)
  await expect(page.locator('[class~="swal2-popup"]')).toContainText("Credenciales inválidas", { timeout: 10_000 });
});

test("lockout doubles after 6 failed attempts (60s then 120s)", { tag: ['@flow:auth-login-attempts', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(60_000);
  await installLoginAttemptsMocks(page);

  // Pre-seed at 5 tries: the next failure is the 6th and hits the next tier
  await seedSignInState(page, { tries: 5, secondsRemaining: 0, secondsAcumulated: 60 });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({ timeout: 15_000 });

  const loginBtn = page.getByRole("button", { name: "Iniciar sesión" });
  await expect(loginBtn).toBeEnabled({ timeout: 15_000 });
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="email"]').fill("wrong@example.com");
  // quality: allow-fragile-selector (stable application ID)
  await page.locator('[id="password"]').fill("wrongpassword");
  await bypassCaptcha(page);
  await loginBtn.click();
  await dismissAttemptAlert(page);

  await expect
    .poll(() => page.evaluate(() => parseInt(localStorage.getItem("signInTries"), 10)), { timeout: 10_000 })
    .toBe(6);

  // Second lockout doubles the accumulated penalty and re-locks the form
  await expect(page.getByText(/Intentar de nuevo en/)).toBeVisible();
  await expect(loginBtn).toBeDisabled();

  const accumulated = await page.evaluate(() => parseInt(localStorage.getItem("signInSecondsAcumulated"), 10));
  expect(accumulated).toBe(120);
});
