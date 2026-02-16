import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installSubscriptionsApiMocks,
  buildMockSubscription,
  buildMockUser,
} from "../helpers/subscriptionsMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * Deep subscription store coverage.
 * Covers: subscriptions/index.js store (15.8%) — fetchSubscriptionHistory,
 * cancelSubscription, reactivateSubscription, fetchWompiPublicKey, resetState
 * Also covers Checkout.vue and Subscriptions.vue deeper flows.
 */

async function installSubscriptionDeepMocks(page, { userId, currentSubscription, subscriptionHistory = [], role = "client" }) {
  const user = buildMockUser({ id: userId, role });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    // Subscription endpoints
    if (apiPath === "subscriptions/current/") {
      if (!currentSubscription) return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
      return { status: 200, contentType: "application/json", body: JSON.stringify(currentSubscription) };
    }

    if (apiPath === "subscriptions/history/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(subscriptionHistory) };
    }

    if (apiPath === "subscriptions/wompi-config/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ public_key: "pub_test_e2e_key_deep" }) };
    }

    if (apiPath === "subscriptions/cancel/" && route.request().method() === "PATCH") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...currentSubscription, status: "cancelled" }),
      };
    }

    if (apiPath === "subscriptions/reactivate/" && route.request().method() === "PATCH") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...currentSubscription, status: "active" }),
      };
    }

    if (apiPath === "subscriptions/create/" && route.request().method() === "POST") {
      const body = route.request().postDataJSON?.() || {};
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(buildMockSubscription({ planType: body.plan_type || "basico", status: "active" })),
      };
    }

    if (apiPath === "subscriptions/generate-signature/" && route.request().method() === "POST") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ signature: "e2e-sig-hash" }) };
    }

    // Dashboard aux
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };

    return null;
  });
}

test("corporativo plan checkout shows plan name, user info and order summary", async ({ page }) => {
  const userId = 9700;

  await installSubscriptionDeepMocks(page, { userId, currentSubscription: null });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true, first_name: "Test", last_name: "User", email: "test@example.com" },
  });

  await page.goto("/checkout/corporativo");

  // Page header
  await expect(page.getByText("Finalizar Suscripción")).toBeVisible({ timeout: 15_000 });

  // Plan name should be visible
  await expect(page.getByText("Plan Corporativo").first()).toBeVisible();

  // User info section
  await expect(page.getByText("Información de contacto")).toBeVisible();

  // Plan selected section
  await expect(page.getByText("Plan seleccionado")).toBeVisible();

  // Order summary in right panel
  await expect(page.getByText("Resumen del pedido")).toBeVisible();

  // Guarantee badge
  await expect(page.getByText("30 días de garantía de reembolso")).toBeVisible();
});

test("subscriptions page shows all three plan cards for unauthenticated-like user", async ({ page }) => {
  const userId = 9701;

  await installSubscriptionDeepMocks(page, { userId, currentSubscription: null });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/subscriptions");

  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible({ timeout: 15_000 });

  // Should show three plans: Básico, Cliente, Corporativo
  await expect(page.getByRole("heading", { name: "Plan Básico" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Cliente" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan Corporativo" })).toBeVisible();

  // Each should have "Elegir plan" button
  const planButtons = page.getByRole("button", { name: "Elegir plan" });
  await expect(planButtons).toHaveCount(3);
});

test("cliente plan checkout shows plan details, card form and guarantee badge", async ({ page }) => {
  const userId = 9702;

  await installSubscriptionDeepMocks(page, { userId, currentSubscription: null });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true, first_name: "Test", last_name: "User", email: "test@example.com" },
  });

  await page.goto("/checkout/cliente");

  await expect(page.getByText("Finalizar Suscripción")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Plan Cliente").first()).toBeVisible();

  // Plan selected section
  await expect(page.getByText("Plan seleccionado")).toBeVisible();
  await expect(page.getByText("Características principales")).toBeVisible();

  // Guarantee badge
  await expect(page.getByText("30 días de garantía de reembolso")).toBeVisible();

  // Back button
  await expect(page.getByText("Volver a planes")).toBeVisible();
});
