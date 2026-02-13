import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installSubscriptionsApiMocks,
  buildMockSubscription,
} from "../helpers/subscriptionsMocks.js";

test("authenticated user with active subscription sees plan info on subscriptions page", async ({ page }) => {
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

  // Should show the plans page with active plan highlighted
  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Plan Básico" })).toBeVisible();

  // All three plan buttons should be visible
  const planButtons = page.getByRole("button", { name: "Elegir plan" });
  await expect(planButtons.first()).toBeVisible();
});

test("authenticated user navigates to paid plan checkout from subscriptions", async ({ page }) => {
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
  await planButtons.nth(1).click();

  // Should navigate to checkout for the cliente plan
  await expect(page).toHaveURL(/\/checkout\/cliente/);
  await expect(page.getByRole("heading", { name: "Finalizar Suscripción" })).toBeVisible({ timeout: 10_000 });
});

test("checkout page shows user contact info and plan details", async ({ page }) => {
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

  await page.goto("/checkout/basico");

  // Should show checkout page elements
  await expect(page.getByRole("heading", { name: "Finalizar Suscripción" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Información de contacto")).toBeVisible();
  await expect(page.getByText("Plan seleccionado")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Básico" })).toBeVisible();

  // "Volver a planes" button should be visible
  await expect(page.getByText("Volver a planes")).toBeVisible();
});

test("checkout back button returns to subscriptions page", async ({ page }) => {
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
