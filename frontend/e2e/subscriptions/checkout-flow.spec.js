import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
import { installWompiStubs } from "../helpers/wompiStubs.js";

const buildCheckoutEmail = (userId) => `checkout-user-${userId}@example.test`;

/**
 * Mock installer for subscription checkout page.
 */
async function installCheckoutMocks(page, { userId, planType = "basico" }) {
  const userEmail = buildCheckoutEmail(userId);
  const user = {
    id: userId,
    first_name: "Test",
    last_name: "User",
    email: userEmail,
    role: "client",
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    is_profile_completed: true,
    is_gym_lawyer: false,
    has_signature: false,
  };

  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    // Subscription endpoints
    if (apiPath === "subscriptions/current/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    if (apiPath === "subscriptions/wompi-config/") return { status: 200, contentType: "application/json", body: JSON.stringify({ public_key: "pub_test_e2e_key" }) };

    // Create subscription (free plan)
    if (apiPath === "subscriptions/create/" && route.request().method() === "POST") {
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          plan_type: planType,
          status: "active",
          created_at: nowIso,
        }),
      };
    }

    // Activity, misc
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

test("selecting the free plan opens its checkout with the buyer's own data", { tag: ['@flow:subscriptions-checkout-free', '@module:subscriptions', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 9100;
  const userEmail = buildCheckoutEmail(userId);

  await installCheckoutMocks(page, { userId, planType: "basico" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true, first_name: "Test", last_name: "User", email: userEmail },
  });

  await page.goto("/subscriptions");
  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible({ timeout: 15_000 });

  // quality: allow-fragile-selector (positional access: first plan card is Plan Básico)
  await page.getByRole("button", { name: "Elegir plan" }).first().click();

  await expect(page).toHaveURL(/\/checkout\/basico/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Plan Básico" })).toBeVisible();
  await expect(page.getByText("Resumen del pedido")).toBeVisible();

  // The checkout is filled with the signed-in buyer, not a placeholder
  await expect(page.getByText("Test User")).toBeVisible();
  await expect(page.getByText(userEmail)).toBeVisible();
  await expect(page.getByRole("button", { name: /Activar Plan Gratuito/i })).toBeVisible();
});

test("selecting the corporate plan opens a paid checkout with the card form", { tag: ['@flow:subscriptions-checkout-paid', '@module:subscriptions', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 9101;
  const userEmail = buildCheckoutEmail(userId);

  await installWompiStubs(page);
  await installCheckoutMocks(page, { userId, planType: "corporativo" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true, first_name: "Test", last_name: "User", email: userEmail },
  });

  await page.goto("/subscriptions");
  await expect(page.getByRole("heading", { name: "Servicios Legales" })).toBeVisible({ timeout: 15_000 });

  // quality: allow-fragile-selector (positional access: third plan card is Plan Corporativo)
  await page.getByRole("button", { name: "Elegir plan" }).nth(2).click();

  await expect(page).toHaveURL(/\/checkout\/corporativo/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Plan Corporativo" })).toBeVisible();

  // A paid plan swaps the free-activation button for the payment section
  await expect(page.getByText("Configura tu método de pago")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar Suscripción" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Activar Plan Gratuito/i })).toHaveCount(0);
});

test("free plan checkout activates subscription successfully", { tag: ['@flow:subscriptions-checkout-free', '@module:subscriptions', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  const userId = 9102;
  const userEmail = buildCheckoutEmail(userId);

  await installCheckoutMocks(page, { userId, planType: "basico" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true, first_name: "Test", last_name: "User", email: userEmail },
  });

  await page.goto("/checkout/basico");

  await expect(page.getByRole("button", { name: /Activar Plan Gratuito/i })).toBeVisible({ timeout: 15_000 });

  // Click to activate free plan
  await page.getByRole("button", { name: /Activar Plan Gratuito/i }).click();

  // Should show success notification
  const successDialog = page.locator('[class~="swal2-popup"]');
  await expect(successDialog).toBeVisible({ timeout: 15_000 });
  await expect(successDialog).toContainText("Activada");
  await page.locator('[class~="swal2-confirm"]').click();

  // Should redirect to dashboard
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
});
