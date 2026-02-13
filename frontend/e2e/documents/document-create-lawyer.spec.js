import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer opens Nueva Minuta modal and fills document name", async ({ page }) => {
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
  await expect(page.locator("#document-name")).toBeVisible({ timeout: 10_000 });

  // Submit button ("Continuar") should be disabled when name is empty
  const submitBtn = page.getByRole("button", { name: "Continuar" });
  await expect(submitBtn).toBeDisabled();

  // Fill the document name
  await page.locator("#document-name").fill("Mi Nueva Minuta E2E");

  // Submit button should now be enabled
  await expect(submitBtn).toBeEnabled();

  // Click Continuar — should navigate to editor create route
  await submitBtn.click();
  await expect(page).toHaveURL(/\/dynamic_document_dashboard\/lawyer\/editor\/create\/Mi%20Nueva%20Minuta%20E2E/, { timeout: 15_000 });
});

test("lawyer clicks Actualizar nombre and sees EditDocumentModal with rename input", async ({ page }) => {
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
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click "Actualizar nombre" from the edit submenu (Draft + legal-documents context)
  await page.getByRole("button", { name: "Actualizar nombre" }).click();

  // The EditDocumentModal should open with pre-filled title
  await expect(page.locator("#document-name")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#document-name")).toHaveValue("Contrato Existente");
});
