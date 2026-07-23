import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installSubscriptionsApiMocks,
  buildMockSubscription,
} from "../helpers/subscriptionsMocks.js";
import { installWompiStubs } from "../helpers/wompiStubs.js";

/**
 * Branch coverage tests for subscription checkout flow.
 * Covers plan selection, free checkout activation, and the paid checkout
 * payment-method branch.
 *
 * NOTE: earlier versions navigated to "/subscription" (a route that does not
 * exist — the catch-all redirected to /sign_in) and asserted `#app` visibility,
 * which could never fail. The real routes are /subscriptions and /checkout/:plan.
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

  await page.goto("/subscriptions");

  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Plan Básico" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Cliente" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Corporativo" })).toBeVisible();
});

test("authenticated client reaches free checkout from basic plan selection", { tag: ['@flow:subscriptions-checkout-free', '@module:subscriptions', '@priority:P1', '@role:shared'] }, async ({ page }) => {
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

  await page.goto("/subscriptions");
  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible({ timeout: 15_000 });

  // quality: allow-fragile-selector (positional access: first plan card is Plan Básico)
  await page.getByRole("button", { name: "Elegir plan" }).first().click();

  await expect(page).toHaveURL(/\/checkout\/basico/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Plan Básico" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activar Plan Gratuito" })).toBeVisible();
});

test("free plan activation posts plan_type and redirects to dashboard", { tag: ['@flow:subscriptions-management', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
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

  await page.goto("/checkout/basico");
  await expect(page.getByRole("button", { name: "Activar Plan Gratuito" })).toBeVisible({ timeout: 15_000 });

  const createRequestPromise = page.waitForRequest(
    (request) =>
      request.url().includes("/api/subscriptions/create/") &&
      request.method() === "POST"
  );

  await page.getByRole("button", { name: "Activar Plan Gratuito" }).click();

  const createRequest = await createRequestPromise;
  expect(createRequest.postDataJSON().plan_type).toBe("basico");

  // quality: allow-fragile-selector (SweetAlert2 popup, precedent in suite)
  const successDialog = page.locator('[class~="swal2-popup"]');
  await expect(successDialog).toBeVisible({ timeout: 10_000 });
  await expect(successDialog).toContainText("¡Suscripción Activada!");
  // quality: allow-fragile-selector (SweetAlert2 confirm button, precedent in suite)
  await page.locator('[class~="swal2-confirm"]').click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
});

test("paid plan checkout requires a payment method before confirming", { tag: ['@flow:subscriptions-checkout-paid', '@module:subscriptions', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 9003;

  await installWompiStubs(page);
  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: buildMockSubscription({ planType: "premium", status: "active", nextBillingDate: "2026-03-15" }),
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/checkout/cliente");

  await expect(page.getByRole("heading", { name: "Plan Cliente" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Método de pago", { exact: true })).toBeVisible();
  await expect(page.getByText("Configura tu método de pago")).toBeVisible();

  // Without a tokenized card the confirm button must stay disabled
  await expect(page.getByRole("button", { name: "Confirmar Suscripción" })).toBeDisabled();
});

test("lawyer user sees subscription plans page", { tag: ['@flow:subscriptions-view-plans', '@module:subscriptions', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
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

  await page.goto("/subscriptions");

  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible({ timeout: 15_000 });
  // All three plans are offered, each with its own selection button
  await expect(page.getByRole("button", { name: "Elegir plan" })).toHaveCount(3);
});
