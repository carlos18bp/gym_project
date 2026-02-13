import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer clicks Enviar por Email on Published doc and sees SendDocumentModal", async ({ page }) => {
  const userId = 10000;

  const docs = [
    buildMockDocument({
      id: 11001,
      title: "Contrato para Enviar",
      state: "Published",
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

  // Click "Enviar por Email" (available for Published documents)
  await page.getByRole("button", { name: "Enviar por Email" }).click();

  // Wait for actions modal to close
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).not.toBeVisible({ timeout: 5_000 });

  // SendDocumentModal should open with email input and file attachment area
  await expect(page.locator("#email")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Correo electrónico")).toBeVisible();
  await expect(page.getByText("Anexos")).toBeVisible();
  await expect(page.getByText("Sube un archivo")).toBeVisible();
});

test("lawyer clicks Administrar Asociaciones on a Completed document and sees DocumentRelationshipsModal", async ({ page }) => {
  const userId = 10001;

  const docs = [
    buildMockDocument({
      id: 11011,
      title: "Contrato Completado",
      state: "Completed",
      createdBy: userId,
      assignedTo: userId,
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
  });

  // Mock the relationships API endpoints used by DocumentRelationshipsModal
  await page.route("**/api/dynamic-documents/*/relationships/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
  await page.route("**/api/dynamic-documents/*/related-documents/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });
  await page.route("**/api/dynamic-documents/*/available-for-relationship/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Switch to Mis Documentos (lawyer) tab where Completed docs show
  await page.getByRole("button", { name: "Mis Documentos" }).click();
  await expect(page.getByText("Contrato Completado")).toBeVisible({ timeout: 10_000 });

  // Click document row to open actions modal
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Click "Administrar Asociaciones"
  await page.getByRole("button", { name: "Administrar Asociaciones" }).click();

  // Wait for actions modal to close
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).not.toBeVisible({ timeout: 5_000 });

  // DocumentRelationshipsModal should open
  await expect(page.getByText("Administrar Asociaciones de Documentos")).toBeVisible({ timeout: 15_000 });
});
