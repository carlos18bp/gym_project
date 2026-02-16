import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("UseDocumentCard: template selection and use flow", () => {
  test("client can view published templates in Nuevo Documento section", async ({ page }) => {
    const userId = 900;

    const docs = [
      buildMockDocument({
        id: 201,
        title: "Plantilla Contrato",
        state: "Published",
        createdBy: 999, // lawyer
        assignedTo: null,
      }),
      buildMockDocument({
        id: 202,
        title: "Plantilla Poder",
        state: "Published",
        createdBy: 999,
        assignedTo: null,
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
    await page.waitForLoadState("networkidle");

    // Click on Nuevo Documento button
    await page.getByRole("button", { name: "Nuevo Documento" }).click();

    // Verify templates are visible
    await expect(page.getByText("Plantilla Contrato")).toBeVisible();
    await expect(page.getByText("Plantilla Poder")).toBeVisible();
  });

  test("client can select a template and see name input", async ({ page }) => {
    const userId = 901;

    const docs = [
      buildMockDocument({
        id: 301,
        title: "Plantilla de Prueba",
        state: "Published",
        createdBy: 999,
        assignedTo: null,
        variables: [
          { name_en: "name", name_es: "Nombre", field_type: "input", value: "" },
        ],
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
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nuevo Documento" }).click();
    await expect(page.getByText("Plantilla de Prueba")).toBeVisible();

    // Click on the template
    await page.getByText("Plantilla de Prueba", { exact: true }).click();

    // Name input should appear
    const nameInput = page.locator("#document-name");
    await expect(nameInput).toBeVisible();
  });

  test("client can go back from template selection", async ({ page }) => {
    const userId = 902;

    const docs = [
      buildMockDocument({
        id: 401,
        title: "Plantilla Alpha",
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
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nuevo Documento" }).click();
    await expect(page.getByRole("button", { name: "Volver a Mis Documentos" })).toBeVisible();

    // Click back button
    await page.getByRole("button", { name: "Volver a Mis Documentos" }).click();

    // Should be back to main view
    await expect(page.getByRole("button", { name: "Nuevo Documento" })).toBeVisible();
  });

  test("client sees empty state when no templates available", async ({ page }) => {
    const userId = 903;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: false,
      documents: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Nuevo Documento" }).click();

    // Should show the templates view (may be empty or show back button)
    await expect(page.getByRole("button", { name: "Volver a Mis Documentos" })).toBeVisible();
  });
});
