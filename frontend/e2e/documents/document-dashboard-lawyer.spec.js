import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer can switch between dashboard tabs", async ({ page }) => {
  const userId = 9000;

  const docs = [
    buildMockDocument({
      id: 101,
      title: "Minuta Contrato",
      state: "Draft",
      createdBy: userId,
    }),
    buildMockDocument({
      id: 102,
      title: "Minuta Tutela",
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

  // Default tab: Minutas should be visible
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Carpetas" })).toBeVisible();

  // Switch to Carpetas tab
  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible({ timeout: 10_000 });

  // Switch back to Minutas tab
  await page.getByRole("button", { name: "Minutas" }).click();
  await expect(page.getByText("Minuta Contrato")).toBeVisible({ timeout: 10_000 });
});

test("lawyer can open folder detail and see documents inside", async ({ page }) => {
  const userId = 9001;

  const docs = [
    buildMockDocument({
      id: 201,
      title: "Doc en Carpeta",
      state: "Draft",
      createdBy: userId,
    }),
  ];

  const folders = [
    buildMockFolder({
      id: 301,
      name: "Carpeta Laboral",
      colorId: 1,
      documents: docs,
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: false,
    documents: docs,
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Switch to Carpetas tab
  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByText("Carpeta Laboral")).toBeVisible({ timeout: 10_000 });

  // Click on the folder to open details
  await page.getByText("Carpeta Laboral", { exact: true }).click();

  // Should see folder heading and document inside
  await expect(page.getByRole("heading", { name: "Carpeta Laboral" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Doc en Carpeta")).toBeVisible();
});

test("lawyer sees document cards with draft and published states", async ({ page }) => {
  const userId = 9002;

  const docs = [
    buildMockDocument({
      id: 401,
      title: "Borrador Importante",
      state: "Draft",
      createdBy: userId,
      tags: [{ id: 1, name: "Laboral" }],
    }),
    buildMockDocument({
      id: 402,
      title: "Plantilla Publicada",
      state: "Published",
      createdBy: userId,
    }),
    buildMockDocument({
      id: 403,
      title: "Doc en Progreso",
      state: "Progress",
      createdBy: userId,
      assignedTo: 5000,
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

  // Should see the Minutas tab with document cards
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Minutas" }).click();

  // Should see document titles in the list
  await expect(page.getByText("Borrador Importante")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Plantilla Publicada")).toBeVisible();

  // Should see state indicators
  await expect(page.getByText("Borrador").first()).toBeVisible();
});
