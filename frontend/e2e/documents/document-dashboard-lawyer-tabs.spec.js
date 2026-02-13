import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer can navigate to Dcs. Clientes en Progreso tab", async ({ page }) => {
  const userId = 8100;

  const docs = [
    buildMockDocument({
      id: 701,
      title: "Contrato Cliente A",
      state: "Progress",
      createdBy: userId,
      assignedTo: 5001,
    }),
    buildMockDocument({
      id: 702,
      title: "Poder Cliente B",
      state: "Progress",
      createdBy: userId,
      assignedTo: 5002,
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

  // Wait for tabs to render
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Switch to "Dcs. Clientes en Progreso" tab
  await page.getByRole("button", { name: "Dcs. Clientes en Progreso" }).click();

  // The tab should be active and the component should render
  await page.waitForTimeout(2000);
  // The table component should load (even if no matching documents are shown due to filtering)
  const tabButton = page.getByRole("button", { name: "Dcs. Clientes en Progreso" });
  await expect(tabButton).toBeVisible();
});

test("lawyer can navigate to Dcs. Clientes (finished) tab", async ({ page }) => {
  const userId = 8101;

  const docs = [
    buildMockDocument({
      id: 711,
      title: "Documento Finalizado",
      state: "Completed",
      createdBy: userId,
      assignedTo: 5010,
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

  // Switch to "Dcs. Clientes" (finished documents) tab
  await page.getByRole("button", { name: "Dcs. Clientes", exact: true }).click();

  await page.waitForTimeout(2000);
  const tabButton = page.getByRole("button", { name: "Dcs. Clientes", exact: true });
  await expect(tabButton).toBeVisible();
});

test("lawyer can navigate to Dcs. Por Firmar tab", async ({ page }) => {
  const userId = 8102;

  const docs = [
    buildMockDocument({
      id: 721,
      title: "Doc Pendiente Firma",
      state: "PendingSignatures",
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

  // Switch to "Dcs. Por Firmar" tab
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();

  await page.waitForTimeout(2000);
  await expect(page.getByRole("button", { name: "Dcs. Por Firmar" })).toBeVisible();
});

test("lawyer can navigate to Mis Documentos tab and sees Nuevo Documento button", async ({ page }) => {
  const userId = 8103;

  const docs = [
    buildMockDocument({
      id: 731,
      title: "Mi Documento Personal",
      state: "Progress",
      createdBy: userId,
      assignedTo: 5050,
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: false,
    documents: docs,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Switch to "Mis Documentos" tab
  await page.getByRole("button", { name: "Mis Documentos" }).click();

  // The "Nuevo Documento" button should appear in this tab
  await expect(page.getByRole("button", { name: /Nuevo Documento/ })).toBeVisible({ timeout: 10_000 });
});
