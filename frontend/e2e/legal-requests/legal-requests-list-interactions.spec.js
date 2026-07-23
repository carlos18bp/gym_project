import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installLegalRequestsApiMocks,
} from "../helpers/legalRequestsMocks.js";

/**
 * E2E — LegalRequestsList.vue deeper interactions.
 *
 * Every test drives a control of the list and asserts the resulting change:
 * - Client: top search bar refetch, card → detail navigation
 * - Lawyer: status dropdown refetch, date-range refetch
 *
 * The mock honors the filter query params, so a broken `@change`/watch handler
 * leaves the list untouched and turns these tests red.
 */

const CLIENT_AUTH = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
});

const LAWYER_AUTH = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
});

// ---------- Client view ----------

test.describe("LegalRequestsList client view", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, () => {
  test("client narrows the list with the top search bar", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 2400;

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "client",
      requestDescription: "Consulta sobre arrendamiento",
    });

    await setAuthLocalStorage(page, CLIENT_AUTH(userId));

    await page.goto("/legal_requests");

    await expect(page.getByRole("heading", { name: "Mis Solicitudes" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("REQ-1001")).toBeVisible({ timeout: 10_000 });

    // Typing a term that no request matches must empty the list
    const searchRequest = page.waitForRequest((request) =>
      request.url().includes("/api/legal_requests/") &&
      request.url().includes("search=hipoteca")
    );
    await page.getByRole("searchbox", { name: "Buscar" }).fill("hipoteca");
    await searchRequest;

    await expect(page.getByText("REQ-1001")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "No se encontraron solicitudes" })).toBeVisible();
  });

  test("client opens the request detail from its card", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 2401;

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "client",
      requestTypeName: "Consulta Legal",
      disciplineName: "Civil",
      requestDescription: "Necesito revisar mi contrato",
    });

    await setAuthLocalStorage(page, CLIENT_AUTH(userId));

    await page.goto("/legal_requests");

    await expect(page.getByText("REQ-1001")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /Ver detalles/i }).click();

    await expect(page).toHaveURL(/\/legal_request_detail\/1001$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Necesito revisar mi contrato")).toBeVisible();
  });
});

// ---------- Lawyer view ----------

test.describe("LegalRequestsList lawyer view", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, () => {
  test("lawyer filters the list by the Pendiente status", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 2410;

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "lawyer",
      requestStatus: "RESPONDED",
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/legal_requests");

    await expect(page.getByRole("heading", { name: "Solicitudes", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("REQ-1001")).toBeVisible({ timeout: 10_000 });

    // The clear-filters button only exists once a filter is applied
    await expect(page.getByRole("button", { name: /Limpiar/ })).toHaveCount(0);

    // quality: allow-fragile-selector (the status dropdown is the only select in this view)
    await page.locator("select").first().selectOption("PENDING");

    // The only seeded request is RESPONDED, so filtering by PENDING empties the grid
    await expect(page.getByText("REQ-1001")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "No hay solicitudes" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Limpiar/ })).toBeVisible();
  });

  test("lawyer restores the full list with the clear-filters button", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 2411;

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "lawyer",
      requestStatus: "RESPONDED",
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/legal_requests");

    await expect(page.getByText("REQ-1001")).toBeVisible({ timeout: 15_000 });

    // quality: allow-fragile-selector (the status dropdown is the only select in this view)
    await page.locator("select").first().selectOption("CLOSED");
    await expect(page.getByText("REQ-1001")).toHaveCount(0);

    await page.getByRole("button", { name: /Limpiar/ }).click();

    await expect(page.getByText("REQ-1001")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Limpiar/ })).toHaveCount(0);
  });
});
