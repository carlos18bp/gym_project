import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * Deep coverage for:
 * - useSendEmail.js (10.3%) — sendEmail composable, validation, loading, success/error
 * - SendDocument.vue (42%) — form fill, file attach, submit, error handling
 * - SendDocumentModal.vue (46.9%) — modal open/close, email field rendering
 */

const lawyerAuth = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
});

test("lawyer fills email form and submits — triggers useSendEmail.sendEmail", async ({ page }) => {
  const userId = 9830;
  const doc = buildMockDocument({ id: 801, title: "Doc para Enviar Email", state: "Published", createdBy: userId });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [doc],
  });

  // Mock the send-email endpoint
  await page.route("**/api/dynamic-documents/801/send-email/", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Email enviado exitosamente" }),
      });
    } else {
      await route.continue();
    }
  });

  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Open actions modal
  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click "Enviar por Email"
  await page.getByRole("button", { name: "Enviar por Email" }).click();

  // SendDocumentModal should open — wait for email input
  await expect(page.locator("#email")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Correo electrónico")).toBeVisible();

  // Fill the email field
  await page.locator("#email").fill("destinatario@example.com");

  // Submit the form — the send button text
  const sendBtn = page.getByRole("button", { name: /Enviar/i }).last();
  await sendBtn.click();

  // useSendEmail triggers loading and then success notification
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 15_000 });
  await page.locator(".swal2-confirm").click();
});

test("lawyer opens send email form and attaches a file", async ({ page }) => {
  const userId = 9831;
  const doc = buildMockDocument({ id: 802, title: "Doc con Anexo", state: "Published", createdBy: userId });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [doc],
  });

  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Enviar por Email" }).click();
  await expect(page.locator("#email")).toBeVisible({ timeout: 15_000 });

  // Attach a file via the file input
  await page.locator("#file-upload").setInputFiles({
    name: "anexo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%fake-pdf\n", "utf-8"),
  });

  // File should appear in the attached files list
  await expect(page.getByText("anexo.pdf")).toBeVisible({ timeout: 5_000 });

  // Drag/drop area text should be replaced by the file card
  await expect(page.getByText("Sube un archivo")).toBeHidden();
});

test("lawyer closes send email modal without submitting", async ({ page }) => {
  const userId = 9832;
  const doc = buildMockDocument({ id: 803, title: "Doc Modal Cerrar", state: "Published", createdBy: userId });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [doc],
  });

  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Enviar por Email" }).click();
  await expect(page.locator("#email")).toBeVisible({ timeout: 15_000 });

  // Close modal via X button
  await page.locator(".fixed button").first().click();

  // Email form should disappear
  await expect(page.locator("#email")).toBeHidden({ timeout: 5_000 });

  // Document list should still be visible
  await expect(page.getByText("Doc Modal Cerrar").first()).toBeVisible({ timeout: 5_000 });
});
