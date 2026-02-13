import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer clicks Completed document in Dcs. Clientes and sees client cardType actions", async ({ page }) => {
  const userId = 10100;

  const docs = [
    buildMockDocument({
      id: 12001,
      title: "Contrato Cliente Completo",
      state: "Completed",
      createdBy: userId,
      assignedTo: 6001,
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

  // Navigate to Dcs. Clientes tab
  await page.getByRole("button", { name: "Dcs. Clientes", exact: true }).click();
  await expect(page.getByText("Contrato Cliente Completo")).toBeVisible({ timeout: 10_000 });

  // Click document row to open actions modal
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Client cardType for Completed docs should show these options
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gestionar Membrete" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Administrar Asociaciones" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar" })).toBeVisible();
});

test("lawyer clicks Progress document in Dcs. Clientes en Progreso and sees limited actions", async ({ page }) => {
  const userId = 10101;

  const docs = [
    buildMockDocument({
      id: 12011,
      title: "Doc Progreso Cliente",
      state: "Progress",
      createdBy: userId,
      assignedTo: 6010,
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

  // Navigate to Dcs. Clientes en Progreso tab
  await page.getByRole("button", { name: "Dcs. Clientes en Progreso" }).click();
  await expect(page.getByText("Doc Progreso Cliente")).toBeVisible({ timeout: 10_000 });

  // Click document row to open actions modal
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Progress context should show Completar, Previsualizar, Eliminar
  await expect(page.getByRole("button", { name: "Completar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar" })).toBeVisible();
});
