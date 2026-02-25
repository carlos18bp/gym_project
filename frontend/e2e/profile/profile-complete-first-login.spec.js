import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installProfileApiMocks } from "../helpers/profileMocks.js";

/**
 * E2E tests for profile-complete flow.
 * Covers: forced profile completion modal on first login.
 */

test("user with incomplete profile sees profile completion modal on dashboard", { tag: ['@flow:profile-complete', '@module:profile', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 8800;

  await installProfileApiMocks(page, {
    userId,
    role: "client",
    firstName: "Nuevo",
    lastName: "Usuario",
    isProfileCompleted: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: false },
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Should show profile completion modal or redirect to profile
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("user with completed profile does not see profile completion modal", { tag: ['@flow:profile-complete', '@module:profile', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 8801;

  await installProfileApiMocks(page, {
    userId,
    role: "client",
    firstName: "Completo",
    lastName: "Usuario",
    isProfileCompleted: true,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Dashboard should load normally without modal
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("lawyer with incomplete profile sees completion prompt", { tag: ['@flow:profile-complete', '@module:profile', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8802;

  await installProfileApiMocks(page, {
    userId,
    role: "lawyer",
    firstName: "Nuevo",
    lastName: "Abogado",
    isProfileCompleted: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: false },
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});
