import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installSubscriptionsApiMocks,
} from "../helpers/subscriptionsMocks.js";
import { installWompiStubs } from "../helpers/wompiStubs.js";

/**
 * E2E tests for the payment-method surface of subscriptions.
 *
 * NOTE: there is currently NO standalone update-payment-method UI (no
 * component calls `subscriptions/update-payment-method/`). The real
 * payment-method flow lives in the paid checkout: tokenize a card, see it
 * saved, and replace it via "Cambiar".
 */

test("user saves a card and can change the payment method in paid checkout", { tag: ['@flow:subscriptions-update-payment', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 9200;

  await installWompiStubs(page);
  await installSubscriptionsApiMocks(page, {
    userId,
    role: "client",
    currentSubscription: null,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/checkout/cliente");
  await expect(page.getByText("Configura tu método de pago")).toBeVisible({ timeout: 15_000 });

  // Fill the card form
  await page.getByPlaceholder("Como aparece en la tarjeta").fill("E2E User");
  await page.getByPlaceholder("0000 0000 0000 0000").fill("4242 4242 4242 4242");
  await page.getByPlaceholder("MM").fill("12");
  await page.getByPlaceholder("AA").fill("29");
  await page.getByPlaceholder("CVC", { exact: true }).fill("123");

  await page.getByRole("button", { name: "Guardar método de pago" }).click();

  // Wompi tokenization stub succeeds — the saved-card state replaces the form
  await expect(page.getByText("Método de pago configurado")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Confirmar Suscripción" })).toBeEnabled();

  // "Cambiar" clears the token and brings the card form back
  await page.getByRole("button", { name: "Cambiar" }).click();
  await expect(page.getByText("Configura tu método de pago")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar Suscripción" })).toBeDisabled();
});

test("user without subscription sees available plans", { tag: ['@flow:subscriptions-view-plans', '@module:subscriptions', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 9201;

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
