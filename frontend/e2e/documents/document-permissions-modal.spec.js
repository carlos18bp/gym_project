import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer opens Permissions modal from document actions and sees permission controls", async ({ page }) => {
  const userId = 9500;

  const docs = [
    buildMockDocument({
      id: 7001,
      title: "Minuta con Permisos",
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

  // Click "Permisos" action — this closes the actions modal and opens the permissions modal
  await page.getByRole("button", { name: "Permisos" }).click();

  // Wait for the actions modal to close first
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).not.toBeVisible({ timeout: 5_000 });

  // DocumentPermissionsModal should open — look for the "Guardar Permisos" button
  await expect(page.getByRole("button", { name: "Guardar Permisos" })).toBeVisible({ timeout: 15_000 });
});

test("client opens Completed document actions and sees Administrar Asociaciones disabled in Progress", async ({ page }) => {
  const userId = 9501;

  const docs = [
    buildMockDocument({
      id: 7011,
      title: "Doc Progreso Asociaciones",
      state: "Progress",
      createdBy: 100,
      assignedTo: userId,
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: docs,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.getByRole("button", { name: "Mis Documentos" }).click();
  await expect(page.getByText("Doc Progreso Asociaciones")).toBeVisible({ timeout: 15_000 });

  // Click document row
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // "Administrar Asociaciones" should be present but disabled for Progress documents
  const assocBtn = page.getByRole("button", { name: "Administrar Asociaciones" });
  await expect(assocBtn).toBeVisible();
  await expect(assocBtn).toBeDisabled();
});
