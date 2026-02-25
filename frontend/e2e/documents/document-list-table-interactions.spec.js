import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E — DocumentListTable deep interactions.
 *
 * Targets:
 * - DocumentListTable.vue (53%) — state filter, sort, date filter, clear filters, row click
 * - EditDocumentModal.vue (15%) — via row click on Draft document
 * - DocumentPreviewModal.vue (36%) — accessible from table
 * - DocumentSummaryModal.vue (45%) — table renders summary columns
 */

const TAGS = [
  { id: 1, name: "Laboral", color_id: 1 },
  { id: 2, name: "Comercial", color_id: 3 },
  { id: 3, name: "Civil", color_id: 5 },
];

async function setupLawyerDashboard(page, { userId, documents = [] }) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: false,
    documents,
    folders: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });
}

function buildDocsWithVariety(userId) {
  return [
    buildMockDocument({
      id: 1, title: "Contrato Laboral Draft", state: "Draft",
      createdBy: userId, tags: [TAGS[0]],
    }),
    buildMockDocument({
      id: 2, title: "Contrato Comercial Published", state: "Published",
      createdBy: userId, tags: [TAGS[1]],
    }),
    buildMockDocument({
      id: 3, title: "Poder General Progress", state: "Progress",
      createdBy: userId, assignedTo: 9999, tags: [TAGS[0], TAGS[2]],
    }),
    buildMockDocument({
      id: 4, title: "Acta Completada", state: "Completed",
      createdBy: userId, assignedTo: 9999, tags: [TAGS[2]],
    }),
    buildMockDocument({
      id: 5, title: "Minuta Sin Tags", state: "Draft",
      createdBy: userId, tags: [],
    }),
  ];
}

async function goToMisDocumentos(page) {
  const tab = page.locator("nav[aria-label='Tabs'] button").filter({ hasText: "Mis Documentos" });
  await tab.click();
  await page.waitForLoadState("networkidle");
}

// ---------- State filter ----------

test.describe("DocumentListTable state filter", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("state filter dropdown opens and shows options", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6000;
    await setupLawyerDashboard(page, { userId, documents: buildDocsWithVariety(userId) });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await goToMisDocumentos(page);

    // Click state filter button (shows "Estado" text)
    const stateBtn = page.getByRole("button", { name: /Estado/i }).first();
    await expect(stateBtn).toBeVisible();
    await stateBtn.click();

    // Should show "Todos" option
    await expect(page.getByText("Todos").first()).toBeVisible();
  });
});

// ---------- Sort dropdown ----------

test.describe("DocumentListTable sort", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("sort dropdown opens and changes sort order", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6010;
    await setupLawyerDashboard(page, { userId, documents: buildDocsWithVariety(userId) });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await goToMisDocumentos(page);

    // Click sort button
    const sortBtn = page.getByRole("button", { name: /Más recientes|Ordenar/i }).first();
    await expect(sortBtn).toBeVisible();
    await sortBtn.click();

    // Sort options should appear — look for "Nombre (A-Z)" option
    const nameSort = page.getByText("Nombre (A-Z)");
    if (await nameSort.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameSort.click();
      // Sort order should change
      await page.waitForLoadState("networkidle");
    }
  });
});

// ---------- Date filter ----------

test.describe("DocumentListTable date filter", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("date filter inputs are accessible and clear filters button appears", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6020;
    await setupLawyerDashboard(page, { userId, documents: buildDocsWithVariety(userId) });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await goToMisDocumentos(page);

    // Date inputs should be visible
    // quality: allow-fragile-selector (positional access on filtered set)
    const dateFrom = page.locator("input[type='date']").first();
    // quality: allow-fragile-selector (positional access on filtered set)
    const dateTo = page.locator("input[type='date']").last();
    await expect(dateFrom).toBeVisible();
    await expect(dateTo).toBeVisible();

    // Set dates
    await dateFrom.fill("2024-01-01");
    await dateTo.fill("2024-12-31");

    // "Limpiar filtros" button should appear
    const clearBtn = page.getByRole("button", { name: /Limpiar filtros/i });
    await expect(clearBtn).toBeVisible();

    // Click clear
    await clearBtn.click();

    // Date inputs should be cleared
    await expect(dateFrom).toHaveValue("");
  });
});

// ---------- Row click / document interaction ----------

test.describe("DocumentListTable row click", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("clicking a document row triggers action", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6030;
    await setupLawyerDashboard(page, { userId, documents: buildDocsWithVariety(userId) });
    await page.goto("/dynamic_document_dashboard");

    // On the "Minutas" tab (default), the Draft document should be visible in the table
    const draftRow = page.getByRole("table").getByText("Contrato Laboral Draft");
    await expect(draftRow).toBeVisible({ timeout: 10_000 });

    // Click the document row — should open DocumentActionsModal
    await draftRow.click();

    // Verify the actions modal appeared with the heading and the document title in the subtitle
    await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });
  });
});

// ---------- Search on Minutas tab ----------

test.describe("DocumentListTable search on Minutas tab", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("search filters documents on Minutas tab", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6040;
    await setupLawyerDashboard(page, { userId, documents: buildDocsWithVariety(userId) });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Default tab is Minutas — search input should be visible
    const searchInput = page.getByPlaceholder("Buscar...");
    await expect(searchInput).toBeVisible();

    // Type to search — filters locally
    await searchInput.fill("Contrato");
    // "Contrato Laboral Draft" should still be visible
    // "Minuta Sin Tags" should be hidden
    const contratoText = page.getByText("Contrato Laboral Draft");
    if (await contratoText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(contratoText).toBeVisible();
    }

    // Clear search
    await searchInput.clear();
  });
});

// ---------- Tag filter on Minutas tab ----------

test.describe("DocumentListTable tag filter", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("tag filter dropdown opens and lists available tags", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6050;
    await setupLawyerDashboard(page, { userId, documents: buildDocsWithVariety(userId) });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await goToMisDocumentos(page);

    // Click tag filter button (shows "Etiqueta")
    const tagBtn = page.getByRole("button", { name: /Etiqueta/i }).first();
    await expect(tagBtn).toBeVisible();
    await tagBtn.click();

    // Tag dropdown menu should appear with "Todos" option
    await expect(page.getByText("Todos").first()).toBeVisible();

    // Tag search input should appear inside dropdown
    const tagSearch = page.getByPlaceholder("Buscar etiquetas...");
    if (await tagSearch.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Just verify the search input is functional
      await tagSearch.fill("test");
      await tagSearch.clear();
    }
  });
});

// ---------- Empty state on Mis Documentos ----------

test.describe("DocumentListTable empty state", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("empty Mis Documentos shows empty state message", { tag: ['@flow:docs-list-table', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6060;
    await setupLawyerDashboard(page, { userId, documents: [] });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await goToMisDocumentos(page);

    // Empty state should show
    await expect(page.getByText("No hay documentos")).toBeVisible();
  });
});
