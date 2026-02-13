import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

test("client can switch between document dashboard tabs", async ({ page }) => {
  const userId = 8000;

  const docs = [
    buildMockDocument({
      id: 501,
      title: "Mi Contrato Laboral",
      state: "Progress",
      createdBy: 999,
      assignedTo: userId,
    }),
    buildMockDocument({
      id: 502,
      title: "Mi Poder Especial",
      state: "Progress",
      createdBy: 999,
      assignedTo: userId,
    }),
  ];

  const folders = [
    buildMockFolder({ id: 601, name: "Carpeta Personal", colorId: 2, documents: [docs[0]] }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: docs,
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Default tab should be folders
  await expect(page.getByText("Carpeta Personal")).toBeVisible({ timeout: 15_000 });

  // Switch to Mis Documentos tab
  const myDocsTab = page.getByRole("button", { name: /Mis Documentos/ });
  await myDocsTab.click();
  await expect(page.getByText("Mi Contrato Laboral")).toBeVisible({ timeout: 10_000 });
});

test("client can click Nuevo Documento to see template selection", async ({ page }) => {
  const userId = 8001;

  const docs = [
    buildMockDocument({
      id: 510,
      title: "Plantilla Disponible",
      state: "Published",
      createdBy: 999,
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
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Click "Nuevo Documento" button
  await page.getByRole("button", { name: /Nuevo Documento/ }).click();

  // Should see the use-document template selection view
  await expect(page.getByText("Plantilla Disponible")).toBeVisible({ timeout: 10_000 });
});

test("client sees electronic signature button on dashboard", async ({ page }) => {
  const userId = 8002;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: true,
    documents: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Electronic signature button should be visible
  await expect(page.getByRole("button", { name: /Firma Electrónica/ })).toBeVisible({ timeout: 15_000 });

  // Click it to open the signature modal
  await page.getByRole("button", { name: /Firma Electrónica/ }).click();

  // Signature modal should appear
  await expect(page.getByRole("heading", { name: "Firma Electrónica" })).toBeVisible({ timeout: 10_000 });
});
