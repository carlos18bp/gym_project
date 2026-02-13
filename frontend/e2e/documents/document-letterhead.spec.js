import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer opens Global Letterhead modal and sees empty state with upload sections", async ({ page }) => {
  const userId = 9200;

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

  // Click Membrete Global button
  await page.getByRole("button", { name: "Membrete Global" }).first().click();

  // Verify the Global Letterhead modal opens
  await expect(page.getByRole("heading", { name: "Gestión de Membrete Global para PDF" })).toBeVisible({ timeout: 10_000 });

  // Should show "Sin Membrete para PDF" empty state (since API returns 404)
  await expect(page.getByText("Sin Membrete para PDF")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("No tienes una imagen de membrete global configurada")).toBeVisible();

  // Should show upload section
  await expect(page.getByText("Subir Membrete de imagen para PDF")).toBeVisible();

  // Should show Word template section
  await expect(page.getByText(/Plantilla Word/)).toBeVisible();
});

test("lawyer opens document-specific Letterhead modal from actions menu", async ({ page }) => {
  const userId = 9201;

  const docs = [
    buildMockDocument({
      id: 4001,
      title: "Contrato con Membrete",
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

  // Click "Gestionar Membrete" action
  await page.getByRole("button", { name: "Gestionar Membrete" }).click();

  // The document-specific LetterheadModal should open
  await expect(page.getByText(/Membrete/i).first()).toBeVisible({ timeout: 10_000 });
});

test("client sees Membrete Global button on document dashboard", async ({ page }) => {
  const userId = 9202;

  const docs = [
    buildMockDocument({
      id: 4011,
      title: "Doc Cliente Membrete",
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

  // Client should see Membrete Global button
  const membreteBtns = page.getByRole("button", { name: "Membrete Global" });
  await expect(membreteBtns.first()).toBeVisible({ timeout: 15_000 });

  // Click it - should open the GlobalLetterheadModal for non-basic clients
  await membreteBtns.first().click();

  await expect(page.getByRole("heading", { name: "Gestión de Membrete Global para PDF" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Sin Membrete para PDF")).toBeVisible({ timeout: 10_000 });
});
