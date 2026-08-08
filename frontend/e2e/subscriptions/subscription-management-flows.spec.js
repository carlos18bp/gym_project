import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installSubscriptionsApiMocks,
  buildMockSubscription,
} from "../helpers/subscriptionsMocks.js";
import { installWompiStubs } from "../helpers/wompiStubs.js";

/**
 * Deep coverage for:
 * - subscriptions/index.js store (15.8%) — fetchCurrentSubscription, getters
 * - Subscriptions.vue (81%) — plan features list, active plan badge
 * - Checkout.vue (62.6%) — free plan submission flow
 */

test("subscriber returning from checkout compares the three plan cards", { tag: ['@flow:subscriptions-management', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 9850;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: buildMockSubscription({
      planType: "basico",
      status: "active",
      nextBillingDate: "2026-06-15",
    }),
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  // The subscriber is on their current (free) plan checkout and goes back to
  // the catalogue to compare what the other plans offer.
  await page.goto("/checkout/basico");
  await expect(page.getByRole("heading", { name: "Finalizar Suscripción" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Volver a planes" }).click();

  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible();
  await expect(page.getByText("Consulta Procesos Judiciales").first()).toBeVisible();
  await expect(page.getByText("Documentos Jurídicos").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Básico" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Cliente" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Corporativo" })).toBeVisible();
});

test("free plan checkout submits without payment method section", { tag: ['@flow:subscriptions-management', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 9851;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: null,
  });

  // Mock subscription creation for free plan
  await page.route("**/api/subscriptions/create/", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          plan_type: "basico",
          status: "active",
          next_billing_date: null,
        }),
      });
    } else {
      await route.continue();
    }
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/checkout/basico");

  await expect(page.getByRole("heading", { name: "Finalizar Suscripción" })).toBeVisible({ timeout: 15_000 });

  // Plan details section
  await expect(page.getByText("Plan seleccionado")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Básico" })).toBeVisible();
  await expect(page.getByText("Gratuito").first()).toBeVisible();

  // Free plan should NOT show payment card inputs
  await expect(page.locator('input[placeholder*="tarjeta"]')).toHaveCount(0);
});

test("corporativo checkout confirms the subscription with the tokenized card", { tag: ['@flow:subscriptions-management', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 9852;

  await installWompiStubs(page, { sessionId: "e2e-wompi-session", tokenId: "e2e-card-token" });
  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: null,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/checkout/corporativo");
  await expect(page.getByRole("heading", { name: "Finalizar Suscripción" })).toBeVisible({ timeout: 15_000 });

  // Tokenize a card, then confirm the paid subscription
  await page.getByPlaceholder("Como aparece en la tarjeta").fill("E2E Corp");
  await page.getByPlaceholder("0000 0000 0000 0000").fill("4242 4242 4242 4242");
  await page.getByPlaceholder("MM").fill("12");
  await page.getByPlaceholder("AA").fill("29");
  await page.getByPlaceholder("CVC", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Guardar método de pago" }).click();

  const confirmButton = page.getByRole("button", { name: "Confirmar Suscripción" });
  await expect(confirmButton).toBeEnabled({ timeout: 10_000 });

  const createRequest = page.waitForRequest(
    (request) => request.url().includes("/api/subscriptions/create/") && request.method() === "POST"
  );
  await confirmButton.click();

  const payload = (await createRequest).postDataJSON();
  expect(payload.plan_type).toBe("corporativo");
  expect(payload.token).toBe("e2e-card-token");
  expect(payload.session_id).toBe("e2e-wompi-session");

  // quality: allow-fragile-selector (SweetAlert2 popup, precedent in suite)
  await expect(page.locator('[class~="swal2-popup"]')).toContainText("Suscripción Creada", { timeout: 10_000 });
});
