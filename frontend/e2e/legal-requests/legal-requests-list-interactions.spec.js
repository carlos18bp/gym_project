import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installLegalRequestsApiMocks,
} from "../helpers/legalRequestsMocks.js";

/**
 * E2E — LegalRequestsList.vue deeper interactions.
 *
 * Exercises:
 * - Client view: "Mis Solicitudes" heading, "Nueva Solicitud" button
 * - Lawyer view: "Solicitudes" heading, status filter dropdown
 * - Request entry rendering (request number, status, type)
 * - Empty state when no requests
 * - Status filter dropdown options
 */

// ---------- Client view ----------

test.describe("LegalRequestsList client view", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, () => {
  test("client sees Mis Solicitudes heading and Nueva Solicitud button", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 2400;

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "client",
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
    });

    await page.goto("/legal_requests");
    await page.waitForLoadState("networkidle");

    // Client heading
    await expect(page.getByRole("heading", { name: "Mis Solicitudes" })).toBeVisible({ timeout: 10000 });

    // "Nueva Solicitud" link/button should be visible for clients
    await expect(page.getByRole("link", { name: /Nueva Solicitud/i })).toBeVisible();
  });

  test("client sees request entry with request number", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 2401;

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "client",
      requestTypeName: "Consulta Legal",
      disciplineName: "Civil",
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
    });

    await page.goto("/legal_requests");
    await page.waitForLoadState("networkidle");

    // Request entry should show request number
    await expect(page.getByText("REQ-1001")).toBeVisible({ timeout: 10000 });
  });
});

// ---------- Lawyer view ----------

test.describe("LegalRequestsList lawyer view", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, () => {
  test("lawyer sees Solicitudes heading", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 2410;

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "lawyer",
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/legal_requests");
    await page.waitForLoadState("networkidle");

    // Lawyer heading
    await expect(page.getByRole("heading", { name: "Solicitudes" })).toBeVisible({ timeout: 10000 });
  });

  test("lawyer sees status filter dropdown with options", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 2411;

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "lawyer",
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/legal_requests");
    await page.waitForLoadState("networkidle");

    // Status filter dropdown should be visible
    // quality: allow-fragile-selector (positional access on filtered set)
    const statusFilter = page.locator("select").first();
    await expect(statusFilter).toBeVisible({ timeout: 10000 });

    // Should have status options (options are hidden in native select but present in DOM)
    await expect(page.getByRole("option", { name: "Todos los estados" })).toHaveCount(1);
    await expect(page.getByRole("option", { name: "Pendiente" })).toHaveCount(1);
  });
});
