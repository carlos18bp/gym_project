import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer can open create folder modal from Carpetas tab", async ({ page }) => {
  const userId = 8200;

  const folders = [
    buildMockFolder({ id: 801, name: "Carpeta Existente", colorId: 1 }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [],
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Navigate to Carpetas tab
  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible({ timeout: 15_000 });

  // Verify "Nueva Carpeta" button is visible
  const newFolderBtn = page.getByRole("button", { name: /Nueva Carpeta/ }).first();
  await expect(newFolderBtn).toBeVisible({ timeout: 10_000 });

  // Verify the existing folder is listed
  await expect(page.getByText("Carpeta Existente")).toBeVisible();
});

test("lawyer sees existing folders listed on Carpetas tab", async ({ page }) => {
  const userId = 8201;

  const folders = [
    buildMockFolder({ id: 811, name: "Carpeta Laboral", colorId: 0 }),
    buildMockFolder({ id: 812, name: "Carpeta Civil", colorId: 2 }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [],
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Navigate to Carpetas tab
  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible({ timeout: 15_000 });

  // Should see both folders
  await expect(page.getByText("Carpeta Laboral")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Carpeta Civil")).toBeVisible();
});

test("client sees folders on default Carpetas tab", async ({ page }) => {
  const userId = 8202;

  const folders = [
    buildMockFolder({ id: 821, name: "Mis Documentos Laborales", colorId: 1 }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [],
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Client default tab is folders
  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Mis Documentos Laborales")).toBeVisible({ timeout: 10_000 });
});

test("client can open create folder modal", async ({ page }) => {
  const userId = 8203;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [],
    folders: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible({ timeout: 15_000 });

  // Verify "Nueva Carpeta" button is visible
  const newFolderBtn = page.getByRole("button", { name: /Nueva Carpeta/ }).first();
  await expect(newFolderBtn).toBeVisible({ timeout: 10_000 });
});
