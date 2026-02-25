import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer opens Nueva Minuta modal and fills document name", { tag: ['@flow:docs-create-template', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9300;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Click "Nueva Minuta" button
  await page.getByRole("button", { name: "Nueva Minuta" }).first().click();

  // Modal should open with name input
  await expect(page.locator("#document-name")).toBeVisible({ timeout: 10_000 }); // quality: allow-fragile-selector (stable DOM id)

  // Submit button ("Continuar") should be disabled when name is empty
  const submitBtn = page.getByRole("button", { name: "Continuar" });
  await expect(submitBtn).toBeDisabled();

  // Fill the document name
  await page.locator("#document-name").fill("Mi Nueva Minuta E2E"); // quality: allow-fragile-selector (stable DOM id)

  // Submit button should now be enabled
  await expect(submitBtn).toBeEnabled();

  // Click Continuar — should navigate to editor create route
  await submitBtn.click();
  await expect(page).toHaveURL(/\/dynamic_document_dashboard\/lawyer\/editor\/create\/Mi%20Nueva%20Minuta%20E2E/, { timeout: 15_000 });
});

test("lawyer clicks Actualizar nombre and sees EditDocumentModal with rename input", { tag: ['@flow:docs-create-template', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9301;

  const docs = [
    buildMockDocument({
      id: 5001,
      title: "Contrato Existente",
      state: "Draft",
      createdBy: userId,
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Click document row to open actions modal
  await page.locator('table tbody tr').first().click(); // quality: allow-fragile-selector (positional selector for first matching element)
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click "Actualizar nombre" from the edit submenu (Draft + legal-documents context)
  await page.getByRole("button", { name: "Actualizar nombre" }).click();

  // The EditDocumentModal should open with pre-filled title
  await expect(page.locator("#document-name")).toBeVisible({ timeout: 10_000 }); // quality: allow-fragile-selector (stable DOM id)
  await expect(page.locator("#document-name")).toHaveValue("Contrato Existente"); // quality: allow-fragile-selector (stable DOM id)
});

test("EditDocumentModal Actualizar nombre button is disabled when title unchanged", { tag: ['@flow:docs-create-template', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9302;

  const docs = [
    buildMockDocument({
      id: 5002,
      title: "Contrato Sin Cambio",
      state: "Draft",
      createdBy: userId,
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.locator("table tbody tr").first().click(); // quality: allow-fragile-selector (positional selector for first matching element)
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Actualizar nombre" }).click();
  await expect(page.locator("#document-name")).toBeVisible({ timeout: 10_000 }); // quality: allow-fragile-selector (stable DOM id)

  // "Actualizar nombre" button should be disabled because title hasn't changed
  const updateBtn = page.getByRole("button", { name: "Actualizar nombre" });
  await expect(updateBtn).toBeDisabled();
});

test("EditDocumentModal enables Actualizar nombre button after changing title", { tag: ['@flow:docs-create-template', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9303;

  const docs = [
    buildMockDocument({
      id: 5003,
      title: "Contrato Original",
      state: "Draft",
      createdBy: userId,
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
  });

  // Mock update endpoint
  await page.route("**/api/dynamic-documents/*/update/", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: 5003, title: "Contrato Modificado" }),
    });
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.locator("table tbody tr").first().click(); // quality: allow-fragile-selector (positional selector for first matching element)
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Actualizar nombre" }).click();

  const nameInput = page.locator("#document-name"); // quality: allow-fragile-selector (stable DOM id)
  await expect(nameInput).toBeVisible({ timeout: 10_000 });

  // Change the title
  await nameInput.clear();
  await nameInput.fill("Contrato Modificado");

  // "Actualizar nombre" button should now be enabled
  const updateBtn = page.getByRole("button", { name: "Actualizar nombre" });
  await expect(updateBtn).toBeEnabled();
});
