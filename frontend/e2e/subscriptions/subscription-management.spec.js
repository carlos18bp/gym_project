import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installSubscriptionsApiMocks,
  buildMockSubscription,
} from "../helpers/subscriptionsMocks.js";

test("subscriber with an active plan can still switch plan from the plans page", { tag: ['@flow:subscriptions-management', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 850;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: buildMockSubscription({
      planType: "basico",
      status: "active",
      nextBillingDate: "2026-03-15",
    }),
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/subscriptions");
  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible({ timeout: 10_000 });

  // Holding an active plan does not lock the catalogue: the free plan card
  // still routes to its checkout.
  // quality: allow-fragile-selector (positional access: first plan card is Plan Básico)
  await page.getByRole("button", { name: "Elegir plan" }).first().click();

  await expect(page).toHaveURL(/\/checkout\/basico/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Plan Básico" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Activar Plan Gratuito" })).toBeVisible();
});

test("authenticated user navigates to paid plan checkout from subscriptions", { tag: ['@flow:subscriptions-management', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 851;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: null,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/subscriptions");

  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible({ timeout: 10_000 });

  // Click the second plan's "Elegir plan" button (Plan Cliente)
  const planButtons = page.getByRole("button", { name: "Elegir plan" });
  await planButtons.nth(1).click(); // quality: allow-fragile-selector (positional selector for specific list item)

  // Should navigate to checkout for the cliente plan
  await expect(page).toHaveURL(/\/checkout\/cliente/);
  await expect(page.getByRole("heading", { name: "Finalizar Suscripción" })).toBeVisible({ timeout: 10_000 });
});

test("plan selection carries the contact and plan sections into checkout", { tag: ['@flow:subscriptions-management', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 852;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: null,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/subscriptions");
  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible({ timeout: 10_000 });

  // quality: allow-fragile-selector (positional access: first plan card is Plan Básico)
  await page.getByRole("button", { name: "Elegir plan" }).first().click();

  await expect(page.getByRole("heading", { name: "Finalizar Suscripción" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Información de contacto")).toBeVisible();
  await expect(page.getByText("Plan seleccionado")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Básico" })).toBeVisible();
});

test("checkout back button returns to subscriptions page", { tag: ['@flow:subscriptions-management', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 853;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: null,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/checkout/basico");

  await expect(page.getByText("Volver a planes")).toBeVisible({ timeout: 10_000 });
  await page.getByText("Volver a planes").click();

  await expect(page).toHaveURL(/\/subscriptions/);
});
