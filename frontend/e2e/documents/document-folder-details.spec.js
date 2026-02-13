import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer clicks a folder row and sees FolderDetailsModal with documents list", async ({ page }) => {
  const userId = 9400;

  const docs = [
    buildMockDocument({ id: 6001, title: "Doc en Carpeta A", state: "Draft", createdBy: userId }),
    buildMockDocument({ id: 6002, title: "Doc en Carpeta B", state: "Published", createdBy: userId }),
  ];

  const folders = [
    buildMockFolder({ id: 301, name: "Carpeta Contratos", documents: [docs[0], docs[1]] }),
    buildMockFolder({ id: 302, name: "Carpeta Vacía", documents: [] }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Switch to Carpetas tab
  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByText("Carpeta Contratos")).toBeVisible({ timeout: 10_000 });

  // Click folder row to open details modal
  await page.getByText("Carpeta Contratos").click();

  // FolderDetailsModalTable should show the documents
  await expect(page.getByText("Doc en Carpeta A")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Doc en Carpeta B")).toBeVisible();

  // "Agregar documentos" button should be visible
  await expect(page.getByRole("button", { name: "Agregar documentos" }).first()).toBeVisible();
});

test("lawyer opens AddDocumentsModal from folder details", async ({ page }) => {
  const userId = 9401;

  const docs = [
    buildMockDocument({ id: 6011, title: "Doc Suelto", state: "Draft", createdBy: userId }),
  ];

  const folders = [
    buildMockFolder({ id: 311, name: "Carpeta Para Agregar", documents: [] }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Switch to Carpetas tab
  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByText("Carpeta Para Agregar")).toBeVisible({ timeout: 10_000 });

  // Click folder to open details
  await page.getByText("Carpeta Para Agregar").click();

  // Click "Agregar documentos" button in the details modal
  await page.getByRole("button", { name: "Agregar documentos" }).first().click();

  // AddDocumentsModal should open with heading and category tabs
  await expect(page.getByRole("heading", { name: "Agregar Documentos" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Selecciona documentos para agregar a "Carpeta Para Agregar"')).toBeVisible();

  // Verify category tabs are rendered inside the add-documents modal
  const addModal = page.locator('div').filter({ hasText: 'Agregar Documentos' }).filter({ has: page.getByRole("button", { name: /Firmas Pendientes/ }) });
  await expect(addModal.getByRole("button", { name: /Firmas Pendientes/ })).toBeVisible();
  await expect(addModal.getByRole("button", { name: /Documentos Firmados/ })).toBeVisible();
});

test("client views folders tab and clicks a folder", async ({ page }) => {
  const userId = 9402;

  const docs = [
    buildMockDocument({ id: 6021, title: "Doc Cliente", state: "Progress", createdBy: 100, assignedTo: userId }),
  ];

  const folders = [
    buildMockFolder({ id: 321, name: "Carpeta Cliente", documents: [docs[0]] }),
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
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Client default tab is Carpetas
  await expect(page.getByText("Carpeta Cliente")).toBeVisible({ timeout: 15_000 });

  // Click folder to open details
  await page.getByText("Carpeta Cliente").click();

  // Should see the document inside
  await expect(page.getByText("Doc Cliente")).toBeVisible({ timeout: 10_000 });
});
