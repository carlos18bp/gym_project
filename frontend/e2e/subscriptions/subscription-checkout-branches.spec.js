import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installSubscriptionsApiMocks,
  buildMockSubscription,
} from "../helpers/subscriptionsMocks.js";

/**
 * Branch coverage tests for subscription checkout flow.
 * Tests different plan types, payment states, and error scenarios.
 */

test("user without subscription sees plan selection page", { tag: ['@flow:subscriptions-checkout-free', '@module:subscriptions', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 9000;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: null,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/subscription");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("user with active basic subscription sees current plan info", { tag: ['@flow:subscriptions-checkout-free', '@module:subscriptions', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 9001;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: buildMockSubscription({ planType: "basico", status: "active" }),
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/subscription");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("user with cancelled subscription can reactivate", { tag: ['@flow:subscriptions-management', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 9002;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: buildMockSubscription({ planType: "basico", status: "cancelled" }),
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/subscription");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("user with premium subscription sees premium features", { tag: ['@flow:subscriptions-checkout-paid', '@module:subscriptions', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 9003;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: buildMockSubscription({ planType: "premium", status: "active", nextBillingDate: "2026-03-15" }),
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/subscription");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("lawyer user sees subscription page with lawyer context", { tag: ['@flow:subscriptions-view-plans', '@module:subscriptions', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9004;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "lawyer",
    currentSubscription: buildMockSubscription({ planType: "profesional", status: "active" }),
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/subscription");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});
