import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installLegalRequestsApiMocks,
  buildMockLegalRequestDetail,
} from "../helpers/legalRequestsMocks.js";

/**
 * Deep coverage for:
 * - ResponseForm.vue — submit response form, character count
 * - ResponseThread.vue — empty state, response list
 * - legal_requests_management.js — createResponse, deleteRequest actions
 * - LegalRequestDetail.vue — lawyer response flow, delete completion
 */

test("lawyer submits a response on a legal request detail page", async ({ page }) => {
  const userId = 9890;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "lawyer",
    requestTypeName: "Consulta",
    disciplineName: "Civil",
    requestDescription: "Solicitud pendiente de respuesta",
  });

  // Override detail to show empty responses (triggers ResponseThread empty state)
  await page.route("**/api/legal_requests/1001/", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMockLegalRequestDetail({
          id: 1001,
          userId,
          requestNumber: "REQ-1001",
          status: "PENDING",
          firstName: "Client",
          lastName: "User",
          email: "client@example.com",
          requestTypeName: "Consulta",
          disciplineName: "Civil",
          description: "Solicitud pendiente de respuesta",
          files: [],
          responses: [],
        })),
      });
    } else {
      await route.continue();
    }
  });

  // Mock response creation endpoint
  await page.route("**/api/legal_requests/1001/responses/", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          response: {
            id: 8001,
            request: 1001,
            response_text: "Revisaremos su caso lo antes posible.",
            created_at: new Date().toISOString(),
          },
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

  await page.goto("/legal_request_detail/1001");

  await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });

  // ResponseThread should be visible with empty state
  await expect(page.getByText("Conversación")).toBeVisible();
  await expect(page.getByText("No hay respuestas aún")).toBeVisible();

  // Type a response
  const textarea = page.locator("textarea");
  await textarea.fill("Revisaremos su caso lo antes posible.");

  // Character count should update
  await expect(page.getByText(/37\/1000/)).toBeVisible();

  // Submit button should be enabled
  const submitBtn = page.getByRole("button", { name: "Responder" });
  await expect(submitBtn).toBeEnabled();
  await submitBtn.click();

  // After submission, textarea should be cleared
  await expect(textarea).toHaveValue("", { timeout: 5_000 });
});

test("lawyer completes delete action on legal request detail", async ({ page }) => {
  const userId = 9891;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "lawyer",
    requestTypeName: "Tutela",
    disciplineName: "Laboral",
    requestDescription: "Solicitud para eliminar completamente",
  });

  // Mock delete endpoint
  await page.route("**/api/legal_requests/1001/delete/", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 204,
        contentType: "application/json",
        body: "",
      });
    } else {
      await route.continue();
    }
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

  // Type confirmation and click delete
  await page.getByPlaceholder("eliminar").fill("eliminar");
  await page.getByRole("button", { name: "Eliminar Solicitud" }).click();

  // After successful delete, should redirect to list or show notification
  // The deleteRequest action removes from store and may trigger navigation
  await expect(page.getByRole("heading", { name: "Eliminar Solicitud" })).toBeHidden({ timeout: 10_000 });
});

test("client sees empty response state with client-specific message", async ({ page }) => {
  const userId = 9892;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "client",
    requestTypeName: "Consulta",
    disciplineName: "Civil",
    requestDescription: "Mi consulta sin respuesta",
  });

  await page.route("**/api/legal_requests/1001/", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMockLegalRequestDetail({
          id: 1001,
          userId,
          requestNumber: "REQ-1001",
          status: "PENDING",
          firstName: "Client",
          lastName: "User",
          email: "client@example.com",
          requestTypeName: "Consulta",
          disciplineName: "Civil",
          description: "Mi consulta sin respuesta",
          files: [],
          responses: [],
        })),
      });
    } else {
      await route.continue();
    }
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/legal_request_detail/1001");

  await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });

  // Client empty state message is different from lawyer
  await expect(page.getByText("No hay respuestas aún")).toBeVisible();
  await expect(page.getByText("El abogado aún no ha respondido a tu solicitud")).toBeVisible();

  // ResponseForm should show client indicator
  await expect(page.getByText("Respondiendo como cliente")).toBeVisible();

  // Character count should start at 0
  await expect(page.getByText("0/1000")).toBeVisible();
});
