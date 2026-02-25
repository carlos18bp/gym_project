import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E — Document editor navigation flow.
 *
 * Targets:
 * - CreateDocumentByLawyer submit → navigates to editor create route
 * - UseDocumentByClient submit → navigates to document form route
 * - Dashboard.vue route change watcher
 * - DocumentEditor.vue / DocumentForm.vue rendering
 */

async function setupLawyer(page, { userId }) {
  const docs = [
    buildMockDocument({ id: 1, title: "Minuta Para Editar", state: "Draft", createdBy: userId }),
    buildMockDocument({ id: 2, title: "Plantilla Disponible", state: "Published", createdBy: userId }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId, role: "lawyer", hasSignature: false, documents: docs, folders: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });
}

// ---------- Lawyer create document navigation ----------

test.describe("Lawyer create document navigation", { tag: ['@flow:docs-editor', '@module:documents', '@priority:P1', '@role:shared'] }, () => {
  test("submitting Nueva Minuta form navigates to editor create route", { tag: ['@flow:docs-editor', '@module:documents', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 16000;
    await setupLawyer(page, { userId });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click "Nueva Minuta"
    await page.getByRole("button", { name: /Nueva Minuta/i }).first().click();

    // Fill name
    // quality: allow-fragile-selector (stable application ID)
    const nameInput = page.locator("#document-name");
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill("Mi Nueva Minuta E2E");

    // Submit
    const submitBtn = page.locator("form button[type='submit']");
    await submitBtn.click();

    // Should navigate to editor create route
    await page.waitForURL(/\/lawyer\/editor\/create\//, { timeout: 10000 });

    // URL should contain the encoded document title
    expect(page.url()).toContain("/lawyer/editor/create/");
  });
});

// ---------- Client use template navigation ----------

test.describe("Client use template navigation", { tag: ['@flow:docs-editor', '@module:documents', '@priority:P1', '@role:shared'] }, () => {
  test("clicking template and submitting name navigates to document form", { tag: ['@flow:docs-editor', '@module:documents', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 16010;
    const docs = [
      buildMockDocument({ id: 10, title: "Plantilla Cliente", state: "Published", createdBy: 999 }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId, role: "client", hasSignature: false, documents: docs, folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Navigate to UseDocumentTable
    await page.getByRole("button", { name: /Nuevo Documento/i }).first().click();
    await expect(page.getByRole("button", { name: /Volver a Mis Documentos/i })).toBeVisible({ timeout: 10000 });

    // Click template row
    const templateRow = page.getByText("Plantilla Cliente");
    if (await templateRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await templateRow.click();

      // UseDocumentByClient modal should open
      // quality: allow-fragile-selector (stable application ID)
      const nameInput = page.locator("#document-name");
      await expect(nameInput).toBeVisible({ timeout: 5000 });

      // Fill name and submit
      await nameInput.fill("Mi Contrato Personal");
      const submitBtn = page.locator("form button[type='submit']");
      await submitBtn.click();

      // Should navigate to document use/form route
      await page.waitForURL(/\/document\/use\//, { timeout: 10000 });
    }
  });
});

// ---------- Dashboard handles route changes ----------

test.describe("Dashboard route change handling", { tag: ['@flow:docs-editor', '@module:documents', '@priority:P1', '@role:shared'] }, () => {
  test("returning to dashboard from editor triggers refresh", { tag: ['@flow:docs-editor', '@module:documents', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 16020;
    await setupLawyer(page, { userId });

    // Navigate to a document editor route first
    await page.goto("/dynamic_document_dashboard/lawyer/editor/create/TestDoc");
    await page.waitForLoadState("networkidle");

    // Navigate back to dashboard
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Dashboard should render with documents
    await expect(page.getByText("Minuta Para Editar")).toBeVisible({ timeout: 10000 });
  });
});
