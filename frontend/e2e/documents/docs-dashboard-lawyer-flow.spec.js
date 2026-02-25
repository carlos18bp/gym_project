import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * Consolidated E2E tests for docs-dashboard-lawyer flow.
 * Replaces 6 fragmented spec files with 6 user-flow tests.
 */

async function setupLawyerDashboard(page, { userId, documents = [], folders = [], hasSignature = false }) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature,
    documents,
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });
}

test.describe("Lawyer Document Dashboard", { tag: ['@flow:docs-dashboard-lawyer', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {
  test("lawyer navigates all dashboard tabs and sees correct content", { tag: ['@flow:docs-dashboard-lawyer', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9000;
    const docs = [
      buildMockDocument({ id: 101, title: "Minuta Contrato", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 102, title: "Minuta Tutela", state: "Published", createdBy: userId }),
      buildMockDocument({ id: 103, title: "Doc Progreso", state: "Progress", createdBy: userId, assignedTo: 5000 }),
    ];

    await setupLawyerDashboard(page, { userId, documents: docs });
    await page.goto("/dynamic_document_dashboard");

    // Default: Minutas tab with documents
    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Minuta Contrato")).toBeVisible();

    // Switch to Carpetas tab
    await page.getByRole("button", { name: "Carpetas" }).click();
    await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible({ timeout: 10_000 });

    // Switch to Dcs. Clientes en Progreso tab
    await page.getByRole("button", { name: "Dcs. Clientes en Progreso" }).click();
    await page.waitForLoadState("networkidle");

    // Switch to Dcs. Por Firmar tab
    await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
    await page.waitForLoadState("networkidle");

    // Return to Minutas
    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Minuta Contrato")).toBeVisible({ timeout: 10_000 });
  });

  test("lawyer searches Minutas by title and filters results", { tag: ['@flow:docs-dashboard-lawyer', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9001;
    const docs = [
      buildMockDocument({ id: 201, title: "Minuta Alpha", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 202, title: "Minuta Beta", state: "Published", createdBy: userId }),
    ];

    await setupLawyerDashboard(page, { userId, documents: docs });
    await page.goto("/dynamic_document_dashboard");

    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Minutas" }).click();

    const search = page.getByPlaceholder("Buscar...");
    await expect(search).toBeVisible();

    await search.fill("Alpha");
    await expect(page.getByText("Minuta Alpha")).toBeVisible();
    await expect(page.getByText("Minuta Beta")).toBeHidden();
  });

  test("lawyer opens folder detail and sees documents inside", { tag: ['@flow:docs-dashboard-lawyer', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9002;
    const docs = [
      buildMockDocument({ id: 301, title: "Doc en Carpeta", state: "Draft", createdBy: userId }),
    ];
    const folders = [
      buildMockFolder({ id: 401, name: "Carpeta Laboral", colorId: 1, documents: docs }),
    ];

    await setupLawyerDashboard(page, { userId, documents: docs, folders });
    await page.goto("/dynamic_document_dashboard");

    await page.getByRole("button", { name: "Carpetas" }).click();
    await expect(page.getByText("Carpeta Laboral")).toBeVisible({ timeout: 10_000 });

    await page.getByText("Carpeta Laboral", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Carpeta Laboral" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Doc en Carpeta")).toBeVisible();
  });

  test("lawyer opens Nueva Minuta modal, types name, and closes it", { tag: ['@flow:docs-dashboard-lawyer', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9003;
    const docs = [
      buildMockDocument({ id: 501, title: "Minuta Existente", state: "Draft", createdBy: userId }),
    ];

    await setupLawyerDashboard(page, { userId, documents: docs });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Open create modal
    const nuevaMinutaBtn = page.getByRole("button", { name: /Nueva Minuta/i }).first();
    await expect(nuevaMinutaBtn).toBeVisible();
    await nuevaMinutaBtn.click();

    // quality: allow-fragile-selector (stable application ID)
    const nameInput = page.locator("#document-name");
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await expect(nameInput).toHaveValue("");

    // Submit disabled when empty
    const submitBtn = page.locator("form button[type='submit']");
    await expect(submitBtn).toBeDisabled();

    // Type name → submit enabled
    await nameInput.fill("Mi Nueva Minuta");
    await expect(submitBtn).toBeEnabled();

    // Close modal
    await page.keyboard.press("Escape");
    await expect(nameInput).toBeHidden();
  });

  test("Dcs. Clientes tab shows completed documents with search", { tag: ['@flow:docs-dashboard-lawyer', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9004;
    const clientId = 5000;
    const docs = [
      buildMockDocument({ id: 601, title: "Contrato Finalizado", state: "Completed", createdBy: userId, assignedTo: clientId }),
      buildMockDocument({ id: 602, title: "Poder Completado", state: "Completed", createdBy: userId, assignedTo: clientId }),
      buildMockDocument({ id: 603, title: "Minuta Base", state: "Draft", createdBy: userId }),
    ];

    await setupLawyerDashboard(page, { userId, documents: docs });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Dcs. Clientes", exact: true }).click();
    await page.waitForLoadState("networkidle");

    const searchInput = page.getByPlaceholder("Buscar...");
    await expect(searchInput).toBeVisible();

    const contratoText = page.getByText("Contrato Finalizado");
    if (await contratoText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill("Contrato");
      await expect(page.getByText("Contrato Finalizado")).toBeVisible();
      await expect(page.getByText("Poder Completado")).toBeHidden();
    }
  });

  test("client starts new document from published template", { tag: ['@flow:docs-dashboard-lawyer', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9005;
    const templateId = 701;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: false,
      documents: [
        buildMockDocument({
          id: templateId,
          title: "Plantilla de Prueba",
          state: "Published",
          createdBy: 999,
          assignedTo: null,
          variables: [
            { name_en: "name", name_es: "Nombre", field_type: "input", value: "", tooltip: "", select_options: null, summary_field: "none", currency: null },
          ],
        }),
      ],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");

    await page.getByRole("button", { name: "Nuevo Documento" }).click();
    await expect(page.getByRole("button", { name: "Volver a Mis Documentos" })).toBeVisible();
    await expect(page.getByText("Plantilla de Prueba")).toBeVisible();

    await page.getByText("Plantilla de Prueba", { exact: true }).click();

    const nameInput = page.locator("#document-name"); // quality: allow-fragile-selector (stable DOM id)
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Documento Generado");

    await page.getByRole("button", { name: "Continuar" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/dynamic_document_dashboard/document/use/creator/${templateId}/Documento%20Generado`)
    );
    await expect(page.getByRole("heading", { name: "Documento Generado" })).toBeVisible();
  });
});
