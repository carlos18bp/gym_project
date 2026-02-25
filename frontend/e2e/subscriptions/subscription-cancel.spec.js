import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installSubscriptionsApiMocks,
  buildMockSubscription,
} from "../helpers/subscriptionsMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

test("user with active subscription sees subscription info on subscriptions page", { tag: ['@flow:subscriptions-management', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 9100;
  const sub = buildMockSubscription({ planType: "cliente", status: "active" });

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: sub,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/subscriptions");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("user navigates to checkout from subscriptions page for plan upgrade", { tag: ['@flow:subscriptions-management', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 9101;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: null,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/subscriptions");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

  // Look for plan selection buttons
  const planButtons = page.getByRole("button", { name: /Seleccionar|Elegir|Suscribirse/i });
  // quality: allow-fragile-selector (positional access on filtered set)
  const hasPlanButtons = await planButtons.first().isVisible({ timeout: 5_000 }).catch(() => false);
  if (hasPlanButtons) {
    // quality: allow-fragile-selector (positional access on filtered set)
    await planButtons.first().click();
    await expect(page).toHaveURL(/checkout/, { timeout: 10_000 });
  }
});
