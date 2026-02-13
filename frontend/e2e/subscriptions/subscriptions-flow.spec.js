import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installSubscriptionsApiMocks,
  buildMockSubscription,
} from "../helpers/subscriptionsMocks.js";

test("unauthenticated user selecting plan is redirected to subscription sign in", async ({ page }) => {
  // No auth localStorage; but we still mock /api/** to avoid proxying captcha requests to the backend.
  await installSubscriptionsApiMocks(page, {
    userId: 0,
    role: "client",
    currentSubscription: null,
  });

  await page.goto("/subscriptions");

  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible();

  await page
    .getByRole("button", { name: "Elegir plan" })
    .first()
    .click();

  await expect(page).toHaveURL(/\/subscription\/sign_in\?plan=basico/i);
});

test("authenticated user can activate free plan from checkout", async ({ page }) => {
  const userId = 800;

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

  await expect(page.getByRole("heading", { name: "Finalizar Suscripción" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Básico" })).toBeVisible();

  await page.getByRole("button", { name: "Activar Plan Gratuito" }).click();

  // SweetAlert confirmation (default button text is usually 'OK')
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".swal2-popup")).toContainText("¡Suscripción Activada!");
  await page.locator(".swal2-confirm").click();

  // After confirming the SweetAlert dialog, the view redirects to /dashboard
  await expect(page).toHaveURL(/\/dashboard/);
});

test("authenticated user selecting plan from subscriptions goes to checkout", async ({ page }) => {
  const userId = 801;

  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: buildMockSubscription({ planType: "basico", status: "active" }),
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/subscriptions");

  await page
    .getByRole("button", { name: "Elegir plan" })
    .first()
    .click();

  await expect(page).toHaveURL(/\/checkout\/basico/);
});
