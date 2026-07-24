import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

  installLegalRequestsApiMocks,
  buildMockLegalRequestDetail,
} from "../helpers/legalRequestsMocks.js";

/**
 * Deep coverage for:
 * - AddFilesModal.vue (23.3%) — file upload UI, drag zone, file list
 * - LegalRequestDetail.vue (62.5%) — client view, canAddFiles, files section
 * - ResponseThread.vue — response display
 */

test("client sees request detail with empty files and can open AddFilesModal", { tag: ['@flow:legal-detail-client', '@module:legal-requests', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 9880;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "client",
    requestTypeName: "Consulta",
    disciplineName: "Civil",
    requestDescription: "Necesito agregar archivos a mi solicitud",
  });

  // Override detail to ensure user field and empty files
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
          description: "Necesito agregar archivos a mi solicitud",
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

  // Detail page should show request info
  await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Necesito agregar archivos a mi solicitud")).toBeVisible();

  // Files section should show empty state — use heading role to avoid strict mode
  await expect(page.getByRole("heading", { name: "Archivos Adjuntos" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("No hay archivos adjuntos")).toBeVisible({ timeout: 5_000 });

  // Client should see the "Agregar archivos" button
  const addBtn = page.getByRole("button", { name: /Agregar archivos/i });
  await expect(addBtn).toBeVisible();

  // Click to open AddFilesModal
  await addBtn.click();

  // AddFilesModal should open
  await expect(page.getByRole("heading", { name: "Agregar Archivos" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Selecciona archivos adicionales")).toBeVisible();
  await expect(page.getByText("Arrastra archivos aquí o")).toBeVisible();
  await expect(page.getByText("PDF, DOC, DOCX, JPG, PNG hasta 200MB cada uno")).toBeVisible();

  // Upload button should be disabled without files
  const uploadBtn = page.getByRole("button", { name: /Subir/i });
  await expect(uploadBtn).toBeDisabled();

  // Cancel button should close the modal
  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("heading", { name: "Agregar Archivos" })).toBeHidden({ timeout: 5_000 });
});

test("client sees request detail with attached files listed", { tag: ['@flow:legal-detail-client', '@module:legal-requests', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 9881;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "client",
    requestTypeName: "Tutela",
    disciplineName: "Laboral",
    requestDescription: "Solicitud con archivos",
  });

  // Override the detail endpoint to include files
  await page.route("**/api/legal_requests/1001/", async (route) => {
    if (route.request().method() === "GET") {
      const detail = buildMockLegalRequestDetail({
        id: 1001,
        userId,
        requestNumber: "REQ-1001",
        status: "PENDING",
        firstName: "Client",
        lastName: "User",
        email: "client@example.com",
        requestTypeName: "Tutela",
        disciplineName: "Laboral",
        description: "Solicitud con archivos",
        files: [
          { id: 1, file: "/media/legal_requests/contrato.pdf", created_at: new Date().toISOString() },
          { id: 2, file: "/media/legal_requests/cedula.jpg", created_at: new Date().toISOString() },
        ],
        responses: [],
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail),
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

  // Files section should show attached files
  await expect(page.getByText("Archivos Adjuntos")).toBeVisible();
  await expect(page.getByText("contrato.pdf")).toBeVisible();
  await expect(page.getByText("cedula.jpg")).toBeVisible();

  // Empty state should NOT be visible
  await expect(page.getByText("No hay archivos adjuntos")).toBeHidden();
});

test("client posts a reply on the response thread", { tag: ['@flow:legal-detail-client', '@module:legal-requests', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 9882;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "client",
    requestTypeName: "Consulta",
    disciplineName: "Civil",
    requestDescription: "Solicitud con respuestas",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/legal_request_detail/1001");

  await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });

  // The thread starts empty and the submit button is inert
  await expect(page.getByText("No hay respuestas aún")).toBeVisible({ timeout: 10_000 });
  const submit = page.getByRole("button", { name: "Responder" });
  await expect(submit).toBeDisabled();

  await page
    .getByPlaceholder("Escribe tu respuesta o pregunta adicional...")
    .fill("Adjunto el contrato firmado, quedo atento.");
  await expect(submit).toBeEnabled();

  const responseRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/api/legal_requests/1001/responses/") &&
      request.method() === "POST"
  );
  await submit.click();
  const sent = await responseRequest;
  expect(sent.postData()).toContain("Adjunto el contrato firmado, quedo atento.");

  // The new message joins the conversation and the form resets
  await expect(page.getByText("Adjunto el contrato firmado, quedo atento.")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("No hay respuestas aún")).toHaveCount(0);
  await expect(submit).toBeDisabled();
});
