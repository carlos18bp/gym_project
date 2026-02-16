import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockUser,
  buildMockLegalRequestSummary,
  buildMockLegalRequestDetail,
} from "../helpers/legalRequestsMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * Deep coverage for:
 * - legal_requests_management.js (25.7%) — updateRequestStatus, deleteRequest,
 *   fetchRequestDetail, getters
 * - StatusUpdateModal.vue (35.7%) — updateStatus method with store call
 * - DeleteConfirmModal.vue (31.3%) — deleteRequest method with store call + redirect
 * - ResponseThread.vue — rendering responses with files
 */

const REQUEST_ID = 1001;

function installLegalRequestDeepMocks(page, { userId, role, detail, statusUpdateResponse = null }) {
  const user = buildMockUser({ id: userId, role });
  const summary = buildMockLegalRequestSummary({
    id: REQUEST_ID,
    requestNumber: "REQ-1001",
    status: detail.status || "PENDING",
    firstName: "Client",
    lastName: "User",
    email: "client@example.com",
    requestTypeName: "Consulta",
    disciplineName: "Civil",
    description: detail.description || "Test",
  });
  const nowIso = new Date().toISOString();

  return mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-key" }) };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }) };
    if (apiPath === "dropdown_options_legal_request/") return { status: 200, contentType: "application/json", body: JSON.stringify({ legal_request_types: [{ id: 1, name: "Consulta" }], legal_disciplines: [{ id: 1, name: "Civil" }] }) };

    // Requests list
    if (apiPath === "legal_requests/") return { status: 200, contentType: "application/json", body: JSON.stringify({ requests: [summary], count: 1, user_role: role }) };

    // Request detail
    if (apiPath === `legal_requests/${REQUEST_ID}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(detail) };

    // Status update (PATCH legal_requests/{id}/status/)
    if (apiPath === `legal_requests/${REQUEST_ID}/status/` && route.request().method() === "PATCH") {
      const resp = statusUpdateResponse || { request: { ...detail, status: "IN_REVIEW", status_display: "En Revisión" } };
      return { status: 200, contentType: "application/json", body: JSON.stringify(resp) };
    }

    // Delete (DELETE legal_requests/{id}/delete/)
    if (apiPath === `legal_requests/${REQUEST_ID}/delete/` && route.request().method() === "DELETE") {
      return { status: 204, contentType: "application/json", body: "" };
    }

    // Create response
    if (apiPath === `legal_requests/${REQUEST_ID}/responses/` && route.request().method() === "POST") {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ response: { id: 5001, request: REQUEST_ID, response_text: "ok", created_at: nowIso } }) };
    }

    return null;
  });
}

test("lawyer completes status update cycle — exercises store.updateRequestStatus", async ({ page }) => {
  const userId = 9850;
  const detail = buildMockLegalRequestDetail({
    id: REQUEST_ID, userId, requestNumber: "REQ-1001", status: "PENDING",
    firstName: "Client", lastName: "User", email: "client@example.com",
    requestTypeName: "Consulta", disciplineName: "Civil",
    description: "Solicitud pendiente",
  });

  await installLegalRequestDeepMocks(page, { userId, role: "lawyer", detail });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/legal_request_detail/1001");
  await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });

  // Open StatusUpdateModal
  await page.getByRole("button", { name: "Cambiar Estado" }).click();
  await expect(page.getByRole("heading", { name: "Actualizar Estado" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Estado actual:")).toBeVisible();

  // Select new status
  await page.locator("select").selectOption("IN_REVIEW");

  // Click Actualizar — triggers store.updateRequestStatus
  await page.getByRole("button", { name: /^Actualizar$/i }).click();

  // Modal should close after successful update
  await expect(page.getByRole("heading", { name: "Actualizar Estado" })).toBeHidden({ timeout: 10_000 });
});

test("lawyer completes delete cycle — exercises store.deleteRequest + redirect", async ({ page }) => {
  const userId = 9851;
  const detail = buildMockLegalRequestDetail({
    id: REQUEST_ID, userId, requestNumber: "REQ-1001", status: "PENDING",
    firstName: "Client", lastName: "User", email: "client@example.com",
    requestTypeName: "Tutela", disciplineName: "Laboral",
    description: "Solicitud para eliminar",
  });

  await installLegalRequestDeepMocks(page, { userId, role: "lawyer", detail });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/legal_request_detail/1001");
  await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });

  // Open DeleteConfirmModal
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByRole("heading", { name: "Eliminar Solicitud" })).toBeVisible({ timeout: 10_000 });

  // Type confirmation and submit
  await page.getByPlaceholder("eliminar").fill("eliminar");
  await page.getByRole("button", { name: "Eliminar Solicitud" }).click();

  // After successful delete, DeleteConfirmModal emits close + router.replace to legal_requests
  await expect(page.getByRole("heading", { name: "Eliminar Solicitud" })).toBeHidden({ timeout: 10_000 });

  // Should navigate to legal requests list
  await expect(page).toHaveURL(/\/legal_requests/, { timeout: 10_000 });
});

test("lawyer presses Enter in DeleteConfirmModal to trigger delete via handleEnterKey", async ({ page }) => {
  const userId = 9852;
  const detail = buildMockLegalRequestDetail({
    id: REQUEST_ID, userId, requestNumber: "REQ-1001", status: "PENDING",
    firstName: "Client", lastName: "User", email: "client@example.com",
    requestTypeName: "Consulta", disciplineName: "Civil",
    description: "Solicitud Enter",
  });

  await installLegalRequestDeepMocks(page, { userId, role: "lawyer", detail });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/legal_request_detail/1001");
  await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });

  // Open DeleteConfirmModal
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByRole("heading", { name: "Eliminar Solicitud" })).toBeVisible({ timeout: 10_000 });

  // Type confirmation text then press Enter (triggers handleEnterKey)
  const confirmInput = page.getByPlaceholder("eliminar");
  await confirmInput.fill("eliminar");
  await confirmInput.press("Enter");

  // Modal should close and redirect
  await expect(page.getByRole("heading", { name: "Eliminar Solicitud" })).toBeHidden({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/legal_requests/, { timeout: 10_000 });
});

