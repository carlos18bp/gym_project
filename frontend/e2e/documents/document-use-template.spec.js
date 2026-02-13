import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("client clicks Nuevo Documento and sees UseDocumentTable with published templates", async ({ page }) => {
  const userId = 9800;

  const docs = [
    buildMockDocument({
      id: 9001,
      title: "Plantilla Contrato Laboral",
      state: "Published",
      createdBy: 100,
    }),
    buildMockDocument({
      id: 9002,
      title: "Plantilla NDA",
      state: "Published",
      createdBy: 100,
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

  // Click "Nuevo Documento" button (client view)
  await page.getByRole("button", { name: "Nuevo Documento" }).first().click();

  // UseDocumentTable should render with back button and search
  await expect(page.getByRole("button", { name: /Volver a Mis Documentos/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('input[placeholder="Buscar plantillas..."]')).toBeVisible();

  // Should show published templates
  await expect(page.getByText("Plantilla Contrato Laboral")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Plantilla NDA")).toBeVisible();
});

test("lawyer clicks Nuevo Documento from Mis Documentos tab and sees UseDocumentTable", async ({ page }) => {
  const userId = 9801;

  const docs = [
    buildMockDocument({
      id: 9011,
      title: "Formato Poder General",
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

  // Switch to Mis Documentos tab for lawyer
  await page.getByRole("button", { name: "Mis Documentos" }).click();

  // Click "Nuevo Documento" (only visible in my-documents tab for lawyer)
  await page.getByRole("button", { name: "Nuevo Documento" }).first().click();

  // UseDocumentTable should render
  await expect(page.getByRole("button", { name: /Volver a Mis Documentos/i })).toBeVisible({ timeout: 10_000 });

  // Click back to return to my-documents
  await page.getByRole("button", { name: /Volver a Mis Documentos/i }).click();
  await expect(page.getByRole("button", { name: "Mis Documentos" })).toBeVisible({ timeout: 10_000 });
});
