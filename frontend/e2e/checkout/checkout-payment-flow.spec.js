import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for Checkout subscription flows with behavior-first assertions.
 */

function buildMockUser({ id, role }) {
  return {
    id,
    first_name: "E2E",
    last_name: "User",
    email: "e2e@example.com",
    role,
    has_signature: role === "lawyer",
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
  };
}

function buildAuthPayload(user) {
  return {
    token: "e2e-token",
    userAuth: {
      id: user.id,
      role: user.role,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_profile_completed: true,
      is_gym_lawyer: user.is_gym_lawyer,
    },
  };
}

async function installWompiExternalMocks(
  page,
  { cardToken = "tok_card_checkout_e2e", sessionId = "sess_checkout_e2e" } = {}
) {
  await page.route("https://checkout.wompi.co/widget.js*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.WidgetCheckout = function WidgetCheckout(){ this.open = function(){}; };",
    });
  });

  await page.route("https://wompijs.wompi.com/libs/js/v1.js*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `window.$wompi = { initialize: function(callback){ callback({ sessionId: \"${sessionId}\" }, null); } };`,
    });
  });

  await page.route("https://sandbox.wompi.co/v1/tokens/cards", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "CREATED",
        data: { id: cardToken },
      }),
    });
  });
}

async function installCheckoutMocks(
  page,
  {
    user,
    currentSubscription = null,
    createSubscriptionStatus = 201,
    subscriptionRequests = [],
  }
) {
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${user.id}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${user.id}/signature/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_signature: user.has_signature }),
      };
    }

    if (apiPath === "subscriptions/current/") {
      if (currentSubscription) {
        return { status: 200, contentType: "application/json", body: JSON.stringify(currentSubscription) };
      }
      return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    }

    if (apiPath === "subscriptions/wompi-config/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ public_key: "pub_test_key_e2e" }) };
    }

    if (apiPath === "subscriptions/generate-signature/" && route.request().method() === "POST") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ signature: "test_integrity_signature" }) };
    }

    if (apiPath === "subscriptions/create/" && route.request().method() === "POST") {
      const payload = route.request().postDataJSON?.() || {};
      subscriptionRequests.push(payload);

      if (createSubscriptionStatus >= 400) {
        return {
          status: createSubscriptionStatus,
          contentType: "application/json",
          body: JSON.stringify({ error: "subscription_create_failed" }),
        };
      }

      const newSub = {
        id: 5001,
        plan_type: payload.plan_type,
        status: "active",
        next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      return { status: 201, contentType: "application/json", body: JSON.stringify(newSub) };
    }

    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") {
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }),
      };
    }
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };

    return null;
  });
}

test.describe.configure({ timeout: 90_000 });

test("paid checkout keeps subscribe disabled before payment tokenization", async ({ page }) => {
  const user = buildMockUser({ id: 5400, role: "client" });

  await installWompiExternalMocks(page);
  await installCheckoutMocks(page, { user });
  await setAuthLocalStorage(page, buildAuthPayload(user));

  await page.goto("/checkout/cliente");

  await expect(page.getByRole("heading", { name: "Finalizar Suscripción" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Plan Cliente").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Método de pago", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar método de pago" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar Suscripción" })).toBeDisabled();
});

test("paid checkout tokenizes card then posts subscription payload", async ({ page }) => {
  const user = buildMockUser({ id: 5401, role: "client" });
  const subscriptionRequests = [];

  await installWompiExternalMocks(page, {
    cardToken: "tok_card_checkout_e2e",
    sessionId: "sess_checkout_e2e",
  });
  await installCheckoutMocks(page, { user, subscriptionRequests });
  await setAuthLocalStorage(page, buildAuthPayload(user));

  await page.goto("/checkout/cliente");

  await page.getByPlaceholder("Como aparece en la tarjeta").fill("E2E Holder");
  await page.getByPlaceholder("0000 0000 0000 0000").fill("4242 4242 4242 4242");
  await page.getByPlaceholder("MM").fill("12");
  await page.getByPlaceholder("AA").fill("30");
  await page.getByPlaceholder("CVC").fill("123");

  await page.getByRole("button", { name: "Guardar método de pago" }).click();

  const tokenizationDialog = page.locator(".swal2-popup");
  await expect(tokenizationDialog).toBeVisible({ timeout: 15_000 });
  await expect(tokenizationDialog).toContainText("Método de pago agregado");
  await page.locator(".swal2-confirm").click();

  await expect(page.getByText("Método de pago configurado")).toBeVisible();

  const subscribeButton = page.getByRole("button", { name: "Confirmar Suscripción" });
  await expect(subscribeButton).toBeEnabled();
  await subscribeButton.click();

  const subscriptionDialog = page.locator(".swal2-popup");
  await expect(subscriptionDialog).toBeVisible({ timeout: 15_000 });
  await expect(subscriptionDialog).toContainText("Suscripción Creada");
  await page.locator(".swal2-confirm").click();

  await expect
    .poll(() => page.evaluate(() => window.location.pathname), { timeout: 45_000 })
    .toBe("/dashboard");

  expect(subscriptionRequests).toHaveLength(1);
  expect(subscriptionRequests[0]).toMatchObject({
    plan_type: "cliente",
    session_id: "sess_checkout_e2e",
    token: "tok_card_checkout_e2e",
  });
});

test("paid checkout shows incomplete-card warning on empty tokenize submit", async ({ page }) => {
  const user = buildMockUser({ id: 5402, role: "client" });

  await installWompiExternalMocks(page);
  await installCheckoutMocks(page, { user });
  await setAuthLocalStorage(page, buildAuthPayload(user));

  await page.goto("/checkout/cliente");

  await page.getByRole("button", { name: "Guardar método de pago" }).click();

  const warningDialog = page.locator(".swal2-popup");
  await expect(warningDialog).toBeVisible({ timeout: 15_000 });
  await expect(warningDialog).toContainText("Información incompleta");
  await page.locator(".swal2-confirm").click();

  await expect(page.getByRole("button", { name: "Confirmar Suscripción" })).toBeDisabled();
});

test("free checkout creates subscription without payment tokenization", async ({ page }) => {
  const user = buildMockUser({ id: 5403, role: "client" });
  const subscriptionRequests = [];

  await installCheckoutMocks(page, { user, subscriptionRequests });
  await setAuthLocalStorage(page, buildAuthPayload(user));

  await page.goto("/checkout/basico");

  await expect(page.getByText("Plan Básico").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Método de pago" })).toHaveCount(0);

  await page.getByRole("button", { name: "Activar Plan Gratuito" }).click();

  const successDialog = page.locator(".swal2-popup");
  await expect(successDialog).toBeVisible({ timeout: 15_000 });
  await expect(successDialog).toContainText("Suscripción Activada");
  await page.locator(".swal2-confirm").click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  expect(subscriptionRequests).toHaveLength(1);
  expect(subscriptionRequests[0]).toMatchObject({ plan_type: "basico" });
  expect(subscriptionRequests[0].token).toBeUndefined();
  expect(subscriptionRequests[0].session_id).toBeUndefined();
});
