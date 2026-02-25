import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * Consolidated E2E tests for docs-dashboard-client flow.
 * Replaces 6 fragmented spec files with 5 user-flow tests.
 */

async function setupClientDashboard(page, { userId, documents = [], folders = [] }) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents,
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });
}

test.describe("Client Document Dashboard", { tag: ['@flow:docs-dashboard-client', '@module:documents', '@priority:P1', '@role:client'] }, () => {
  test("client navigates all dashboard tabs and sees folders by default", { tag: ['@flow:docs-dashboard-client', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
    const userId = 8000;
    const docs = [
      buildMockDocument({ id: 501, title: "Mi Contrato Laboral", state: "Progress", createdBy: 999, assignedTo: userId }),
    ];
    const folders = [
      buildMockFolder({ id: 601, name: "Carpeta Personal", colorId: 2, documents: [docs[0]] }),
    ];

    await setupClientDashboard(page, { userId, documents: docs, folders });
    await page.goto("/dynamic_document_dashboard");

    // Default tab: Carpetas with folder visible
    await expect(page.getByText("Carpeta Personal")).toBeVisible({ timeout: 15_000 });

    // Client tabs should be present
    const tabs = page.locator("nav[aria-label='Tabs'] button");
    await expect(tabs.filter({ hasText: "Mis Documentos" })).toBeVisible();
    await expect(tabs.filter({ hasText: "Dcs. Por Firmar" })).toBeVisible();
    await expect(tabs.filter({ hasText: "Dcs. Firmados" })).toBeVisible();

    // Navigate through tabs
    await tabs.filter({ hasText: "Mis Documentos" }).click();
    await page.waitForLoadState("networkidle");

    await tabs.filter({ hasText: "Dcs. Por Firmar" }).click();
    await page.waitForLoadState("networkidle");

    await tabs.filter({ hasText: "Dcs. Firmados" }).click();
    await page.waitForLoadState("networkidle");

    await tabs.filter({ hasText: "Dcs. Archivados" }).click();
    await page.waitForLoadState("networkidle");

    // Return to Carpetas
    await tabs.filter({ hasText: "Carpetas" }).click();
    await expect(page.getByText("Carpeta Personal")).toBeVisible({ timeout: 10_000 });
  });

  test("client clicks Nuevo Documento, sees templates, and navigates back", { tag: ['@flow:docs-dashboard-client', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
    const userId = 8001;
    const docs = [
      buildMockDocument({ id: 510, title: "Plantilla Disponible", state: "Published", createdBy: 999 }),
    ];

    await setupClientDashboard(page, { userId, documents: docs });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click Nuevo Documento
    await page.getByRole("button", { name: /Nuevo Documento/i }).first().click();

    // UseDocumentTable renders with back button and template
    const backBtn = page.getByRole("button", { name: /Volver a Mis Documentos/i });
    await expect(backBtn).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Plantilla Disponible")).toBeVisible();

    // Navigate back
    await backBtn.click();
    await page.waitForLoadState("networkidle");

    const misDocsTab = page.locator("nav[aria-label='Tabs'] button").filter({ hasText: "Mis Documentos" });
    await expect(misDocsTab).toBeVisible();
  });

  test("client opens Firma Electrónica modal from dashboard", { tag: ['@flow:docs-dashboard-client', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
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

    await expect(page.getByRole("button", { name: /Firma Electrónica/ })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Firma Electrónica/ }).click();

    await expect(page.getByRole("heading", { name: "Firma Electrónica" })).toBeVisible({ timeout: 10_000 });
  });

  test("lawyer clicks completed client document and sees action options", { tag: ['@flow:docs-dashboard-client', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
    const userId = 8003;
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

    await page.getByRole("button", { name: "Dcs. Clientes", exact: true }).click();
    await expect(page.getByText("Contrato Cliente Completo")).toBeVisible({ timeout: 10_000 });

    await page.locator('table tbody tr').first().click(); // quality: allow-fragile-selector (positional selector for first matching element)
    await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar" })).toBeVisible();
  });

  test("client empty folders shows appropriate empty state", { tag: ['@flow:docs-dashboard-client', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
    const userId = 8004;

    await setupClientDashboard(page, { userId, folders: [] });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("No tienes carpetas aún")).toBeVisible();
  });
});
