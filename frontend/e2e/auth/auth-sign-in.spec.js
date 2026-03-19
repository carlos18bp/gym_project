import { test, expect } from "../helpers/test.js";
import { bypassCaptcha } from "../helpers/captcha.js";
import { installAuthSignInApiMocks } from "../helpers/authSignInMocks.js";

const authEmailForRole = (role, userId) => `${role}.${userId}@test.local`;

async function resetSignInState(page) {
  await page.addInitScript(() => {
    if (window.location.pathname !== "/sign_in") {
      return;
    }
    localStorage.removeItem("token");
    localStorage.removeItem("userAuth");
    localStorage.removeItem("signInTries");
    localStorage.removeItem("signInSecondsRemaining");
    localStorage.removeItem("signInSecondsAcumulated");
    localStorage.removeItem("signInIntervalId");
  });
}


test("client can sign in and is redirected to dashboard", { tag: ['@flow:auth-login-email', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 1000;
  const email = authEmailForRole("client", userId);

  await resetSignInState(page);

  await installAuthSignInApiMocks(page, {
    userId,
    role: "client",
    signInStatus: 200,
  });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({
    timeout: 15_000,
  });

  await page.locator('[id="email"]').fill(email);
  await page.locator('[id="password"]').fill("password");

  await bypassCaptcha(page);

  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 10_000 })
    .toBe("e2e-access-token");

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("client");
});

test("lawyer can sign in and is redirected to dashboard", { tag: ['@flow:auth-login-email', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 1100;
  const email = authEmailForRole("lawyer", userId);

  await resetSignInState(page);

  await installAuthSignInApiMocks(page, {
    userId,
    role: "lawyer",
    signInStatus: 200,
  });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({
    timeout: 15_000,
  });

  await page.locator('[id="email"]').fill(email);
  await page.locator('[id="password"]').fill("password");

  await bypassCaptcha(page);

  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 10_000 })
    .toBe("e2e-access-token");

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("lawyer");
});

test("invalid credentials shows warning", { tag: ['@flow:auth-login-email', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 1200;
  const email = authEmailForRole("client", userId);

  await resetSignInState(page);

  await installAuthSignInApiMocks(page, {
    userId,
    role: "client",
    signInStatus: 401,
  });

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({
    timeout: 15_000,
  });

  await page.locator('[id="email"]').fill(email);
  await page.locator('[id="password"]').fill("wrong");

  await bypassCaptcha(page);

  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page.getByText(/Credenciales inválidas/i)).toBeVisible({ timeout: 10_000 });

  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
});
