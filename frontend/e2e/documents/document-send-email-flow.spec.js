import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

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

test("lawyer fills email form and submits — triggers useSendEmail.sendEmail", { tag: ['@flow:docs-send-email', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
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
  await page.getByRole("row", { name: /Doc para Enviar Email/i }).click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click "Enviar por Email"
  await page.getByRole("button", { name: "Enviar por Email" }).click();

  // SendDocumentModal should open — wait for email input
  const emailInput = page.getByRole("textbox", { name: /correo electrónico/i });
  await expect(emailInput).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Correo electrónico")).toBeVisible();

  // Fill the email field
  await emailInput.fill("destinatario@example.com");

  // Submit the form — the send button text
  const sendBtn = page.getByRole("button", { name: "Enviar" });
  await sendBtn.click();

  // useSendEmail triggers loading and then success notification
  const sendSuccessDialog = page.locator('[role="dialog"], [role="alertdialog"]');
  await expect(sendSuccessDialog).toBeVisible({ timeout: 15_000 });
  await sendSuccessDialog.getByRole("button", { name: /ok|aceptar/i }).click();
});

test("lawyer opens send email form and attaches a file", { tag: ['@flow:docs-send-email', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
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

  await page.getByRole("row", { name: /Doc con Anexo/i }).click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Enviar por Email" }).click();
  const emailInput = page.getByRole("textbox", { name: /correo electrónico/i });
  await expect(emailInput).toBeVisible({ timeout: 15_000 });

  // Attach a file via the file input
  await page.getByLabel("Sube un archivo").setInputFiles({
    name: "anexo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%fake-pdf\n", "utf-8"),
  });

  // File should appear in the attached files list
  await expect(page.getByText("anexo.pdf")).toBeVisible({ timeout: 5_000 });

  // Drag/drop area text should be replaced by the file card
  await expect(page.getByText("Sube un archivo")).toBeHidden();
});

test("lawyer attaches file then removes it from attachment list", { tag: ['@flow:docs-send-email', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9833;
  const doc = buildMockDocument({ id: 804, title: "Doc Remover Archivo", state: "Published", createdBy: userId });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [doc],
  });

  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("row", { name: /Doc Remover Archivo/i }).click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Enviar por Email" }).click();
  const emailInput = page.getByRole("textbox", { name: /correo electrónico/i });
  await expect(emailInput).toBeVisible({ timeout: 15_000 });

  // Attach a file
  await page.getByLabel("Sube un archivo").setInputFiles({
    name: "borrar.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%fake\n", "utf-8"),
  });

  await expect(page.getByText("borrar.pdf")).toBeVisible({ timeout: 5_000 });

  // Hover on file card to reveal remove X button, then click it
  const fileCard = page.getByText("borrar.pdf").locator(".."); // quality: allow-fragile-selector (parent of file name text)
  await fileCard.hover();
  const xButton = fileCard.locator("svg").first(); // quality: allow-fragile-selector (XMarkIcon inside file card)
  if (await xButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await xButton.click();
  }

  // After removal, the upload area text should reappear
  await expect(page.getByText("Sube un archivo")).toBeVisible({ timeout: 5_000 });
});

test("send button is disabled when email field is empty", { tag: ['@flow:docs-send-email', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9834;
  const doc = buildMockDocument({ id: 805, title: "Doc Btn Disabled", state: "Published", createdBy: userId });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [doc],
  });

  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("row", { name: /Doc Btn Disabled/i }).click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Enviar por Email" }).click();
  await expect(page.getByRole("textbox", { name: /correo electrónico/i })).toBeVisible({ timeout: 15_000 });

  // Send button should be disabled when email is empty
  const sendBtn = page.getByRole("button", { name: "Enviar" });
  await expect(sendBtn).toBeDisabled();

  // Fill valid email — button should enable
  await page.getByRole("textbox", { name: /correo electrónico/i }).fill("test@example.com");
  await expect(sendBtn).toBeEnabled();
});

test("lawyer closes send email modal without submitting", { tag: ['@flow:docs-send-email', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
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

  await page.getByRole("row", { name: /Doc Modal Cerrar/i }).click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Enviar por Email" }).click();
  const emailInput = page.getByRole("textbox", { name: /correo electrónico/i });
  await expect(emailInput).toBeVisible({ timeout: 15_000 });

  // Close modal via X button
  await page.locator("form").locator("xpath=preceding-sibling::div//button").click();

  // Email form should disappear
  await expect(emailInput).toBeHidden({ timeout: 5_000 });

  // Document list should still be visible
  await expect(page.getByText("Doc Modal Cerrar", { exact: true })).toBeVisible({ timeout: 5_000 });
});
