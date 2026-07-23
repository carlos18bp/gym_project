import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks, buildMockDocument } from "../helpers/dynamicDocumentMocks.js";
import { openDocumentActionsModal } from "../helpers/documentActions.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * Consolidated E2E tests for docs-letterhead flow.
 * Replaces 6 fragmented spec files with 5 user-flow tests.
 */

test("lawyer opens Global Letterhead modal and sees upload sections", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8600;
  const docs = [
    buildMockDocument({ id: 3001, title: "Doc Membrete", state: "Published", createdBy: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /membrete global/i }).first().click();

  await expect(page.getByRole("heading", { name: "Gestión de Membrete Global para PDF" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Seleccionar Imagen PNG para PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Seleccionar Plantilla .docx (Word)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sin Membrete para PDF" })).toBeVisible();
});

test("lawyer opens document-specific Letterhead modal from actions menu", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8601;
  const docs = [
    buildMockDocument({ id: 3010, title: "Doc Con Membrete", state: "Published", createdBy: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await openDocumentActionsModal(page, "Doc Con Membrete");
  await page.getByTestId("document-action-letterhead").click();

  await expect(page.getByRole("heading", { name: "Gestión de Membrete", exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Sin Membrete", exact: true })).toBeVisible();
});

test("client opens Membrete Global modal from document dashboard", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 8602;
  const docs = [
    buildMockDocument({ id: 3020, title: "Doc Cliente", state: "Completed", createdBy: 999, assignedTo: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "client", hasSignature: false, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  const membreteBtn = page.getByRole("button", { name: /membrete global/i }).first();
  await expect(membreteBtn).toBeVisible({ timeout: 15_000 });
  await membreteBtn.click();

  await expect(page.getByRole("heading", { name: "Gestión de Membrete Global para PDF" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Seleccionar Imagen PNG para PDF" })).toBeVisible();
});

test("letterhead modal shows specifications toggle and Word template section", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8603;
  const docs = [
    buildMockDocument({ id: 3030, title: "Doc Specs", state: "Published", createdBy: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /membrete global/i }).first().click();
  await expect(page.getByRole("heading", { name: "Plantilla Word para documentos (.docx)" })).toBeVisible({ timeout: 10_000 });

  // Specifications section is collapsed by default and toggles on demand.
  await page.getByRole("button", { name: "Ver Especificaciones" }).click();
  await expect(page.getByRole("heading", { name: "Especificaciones del Membrete para PDF" })).toBeVisible();

  await page.getByRole("button", { name: "Ocultar Especificaciones" }).click();
  await expect(page.getByRole("heading", { name: "Especificaciones del Membrete para PDF" })).toBeHidden();
});

test("lawyer uploads a global Word letterhead template", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8604;
  const docs = [
    buildMockDocument({ id: 3040, title: "Doc Word Template", state: "Published", createdBy: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /membrete global/i }).first().click();
  await expect(page.getByRole("button", { name: "Seleccionar Plantilla .docx (Word)" })).toBeVisible({ timeout: 10_000 });

  await page.locator('input[accept=".docx"]').setInputFiles({
    name: "membrete-e2e.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("PK-mock-docx"),
  });

  const uploadRequest = page.waitForRequest((request) =>
    request.url().includes("/api/user/letterhead/word-template/upload/")
  );
  await page.getByRole("button", { name: "Subir Plantilla" }).click();
  await uploadRequest;

  await expect(page.getByText("membrete-e2e.docx")).toBeVisible({ timeout: 10_000 });
});
