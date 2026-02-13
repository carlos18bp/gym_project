import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installLegalRequestsApiMocks,
  buildMockLegalRequestSummary,
} from "../helpers/legalRequestsMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * Deep coverage for:
 * - DeleteConfirmModal.vue (31.3%)
 * - StatusUpdateModal.vue (35.7%)
 * - LegalRequestCard.vue (68.1%) — lawyer action buttons
 * - legal_requests_management.js store (25.7%) — delete/status actions
 */

test("lawyer opens StatusUpdateModal from detail page and selects new status", async ({ page }) => {
  const userId = 9840;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "lawyer",
    requestTypeName: "Consulta",
    disciplineName: "Civil",
    requestDescription: "Solicitud de prueba para status update",
  });

  // Add PATCH mock for status update
  await page.route("**/api/legal_requests/1001/update_status/", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1001,
          request_number: "REQ-1001",
          status: "IN_REVIEW",
          status_display: "IN_REVIEW",
        }),
      });
    } else {
      await route.continue();
    }
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  // Navigate to detail page directly
  await page.goto("/legal_request_detail/1001");

  await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });

  // Lawyer detail page shows "Cambiar Estado" button directly
  await page.getByRole("button", { name: "Cambiar Estado" }).click();

  // StatusUpdateModal should open
  await expect(page.getByText("Actualizar Estado")).toBeVisible({ timeout: 10_000 });
  // REQ-1001 shown both in heading and modal — just verify modal is open
  await expect(page.getByText("Estado actual:")).toBeVisible();

  // Select new status
  await page.locator("select").selectOption("IN_REVIEW");

  // Click update button
  await page.getByRole("button", { name: /^Actualizar$/i }).click();

  // Modal should close
  await expect(page.getByText("Actualizar Estado")).toBeHidden({ timeout: 10_000 });
});

test("lawyer opens DeleteConfirmModal from detail page, types confirmation text", async ({ page }) => {
  const userId = 9841;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "lawyer",
    requestTypeName: "Tutela",
    disciplineName: "Laboral",
    requestDescription: "Solicitud para eliminar",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/legal_request_detail/1001");

  await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });

  // Click "Eliminar" button on the detail page
  await page.getByRole("button", { name: "Eliminar" }).click();

  // DeleteConfirmModal should open — use heading role to avoid strict mode
  await expect(page.getByRole("heading", { name: "Eliminar Solicitud" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Esta acción no se puede deshacer")).toBeVisible();

  // Confirmation input — type "eliminar"
  const confirmInput = page.getByPlaceholder("eliminar");
  await expect(confirmInput).toBeVisible();
  await confirmInput.fill("eliminar");

  // Delete button should now be enabled
  const deleteBtn = page.getByRole("button", { name: "Eliminar Solicitud" });
  await expect(deleteBtn).toBeEnabled();
});

test("DeleteConfirmModal shows validation error when wrong text is typed", async ({ page }) => {
  const userId = 9842;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "lawyer",
    requestTypeName: "Consulta",
    disciplineName: "Civil",
    requestDescription: "Test validation",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/legal_request_detail/1001");

  await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });

  // Open delete modal
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByRole("heading", { name: "Eliminar Solicitud" })).toBeVisible({ timeout: 10_000 });

  // Type wrong confirmation text
  const confirmInput = page.getByPlaceholder("eliminar");
  await confirmInput.fill("wrong");

  // Validation message should appear
  await expect(page.getByText('Debes escribir exactamente "eliminar" para confirmar')).toBeVisible();

  // Delete button should be disabled
  const deleteBtn = page.getByRole("button", { name: "Eliminar Solicitud" });
  await expect(deleteBtn).toBeDisabled();

  // Now type correct text and verify button becomes enabled
  await confirmInput.fill("eliminar");
  await expect(deleteBtn).toBeEnabled();

  // Close modal via Cancel
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("heading", { name: "Eliminar Solicitud" })).toBeHidden({ timeout: 5_000 });
});
