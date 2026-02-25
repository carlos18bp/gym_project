import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E — RelatedDocumentsTab.vue (33.63%).
 *
 * Exercises:
 * - Rendering document list with state colors/badges
 * - Search filtering within related documents
 * - "Pendiente" vs "Relacionado" badges
 * - "Desrelacionar" button
 * - Empty state (no related docs)
 * - Content preview snippets
 * - Relationship info (created_by, created_at)
 * - Tags rendering
 *
 * Access path: Completed doc → ActionsModal → "Administrar Asociaciones"
 * → click "Documentos Relacionados" tab → RelatedDocumentsTab renders.
 */

const LAWYER_ID = 26000;

function buildRelatedDocuments() {
  return [
    {
      id: 601, title: "Contrato Firmado Alpha", state: "FullySigned",
      content: "<p>Contenido del contrato firmado alpha</p>",
      created_at: "2025-01-15T10:30:00Z",
      tags: [{ id: 1, name: "Contratos" }, { id: 2, name: "Urgente" }],
      assigned_to: LAWYER_ID,
    },
    {
      id: 602, title: "Poder Completado Beta", state: "Completed",
      content: "<p>Contenido del poder completado</p>",
      created_at: "2025-02-20T14:00:00Z",
      tags: [],
      assigned_to: LAWYER_ID,
    },
    {
      id: 603, title: "Doc Pendiente Firma Gamma", state: "PendingSignatures",
      content: "<p>Documento pendiente de firma</p>",
      created_at: "2025-03-10T09:00:00Z",
      tags: [{ id: 3, name: "Firma" }],
      assigned_to: LAWYER_ID,
    },
  ];
}

function buildRelationships() {
  return [
    {
      id: 1001, source_document: 500, target_document: 601,
      created_by_name: "Abogado García", created_at: "2025-01-20T12:00:00Z",
    },
    {
      id: 1002, source_document: 500, target_document: 602,
      created_by_name: "Abogado López", created_at: "2025-02-25T16:00:00Z",
    },
    {
      id: 1003, source_document: 603, target_document: 500,
      created_by_name: "Abogado García", created_at: "2025-03-15T11:00:00Z",
    },
  ];
}

async function setupWithRelationships(page, { withRelatedDocs = true } = {}) {
  const mainDoc = buildMockDocument({
    id: 500, title: "Contrato Principal Completado", state: "Completed",
    createdBy: LAWYER_ID, assignedTo: LAWYER_ID,
  });
  mainDoc.relationships_count = withRelatedDocs ? 3 : 0;

  const docs = [mainDoc];
  const relatedDocs = withRelatedDocs ? buildRelatedDocuments() : [];
  const relationships = withRelatedDocs ? buildRelationships() : [];

  await installDynamicDocumentApiMocks(page, {
    userId: LAWYER_ID, role: "lawyer", hasSignature: true, documents: docs,
  });

  // Mock relationships-specific API endpoints
  await page.route("**/api/dynamic-documents/*/relationships/", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(relationships),
    });
  });
  await page.route("**/api/dynamic-documents/*/related-documents/", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(relatedDocs),
    });
  });
  await page.route("**/api/dynamic-documents/*/available-for-relationship/", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: LAWYER_ID, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });
}

async function openRelationshipsModal(page) {
  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // Switch to "Mis Documentos" tab where Completed docs show
  await page.getByRole("button", { name: "Mis Documentos" }).click();
  await expect(page.getByText("Contrato Principal Completado")).toBeVisible({ timeout: 10000 });

  // Click document row to open ActionsModal
  // quality: allow-fragile-selector (positional access on filtered set)
  await page.locator("table tbody tr").first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10000 });

  // Click "Administrar Asociaciones"
  await page.getByRole("button", { name: "Administrar Asociaciones" }).click();

  // Wait for DocumentRelationshipsModal to open
  await expect(page.getByText("Administrar Asociaciones de Documentos")).toBeVisible({ timeout: 15000 });
}

async function switchToRelatedTab(page) {
  // Click "Documentos Relacionados" tab
  const relatedTab = page.getByRole("button", { name: /Documentos Relacionados/ });
  await relatedTab.click();
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(500);
}

// ---------- RelatedDocumentsTab rendering ----------

test.describe("RelatedDocumentsTab renders related documents list", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("shows related document titles and state badges", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page);
    await openRelationshipsModal(page);
    await switchToRelatedTab(page);

    // Related document titles should be visible (use heading role to avoid matching content preview)
    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: "Poder Completado Beta" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Doc Pendiente Firma Gamma" })).toBeVisible();

    // State labels should be rendered
    await expect(page.getByText("Firmado").first()).toBeVisible();
    await expect(page.getByText("Completado").first()).toBeVisible();
    await expect(page.getByText("Pendiente de Firma").first()).toBeVisible();
  });

  test("shows Relacionado badge for confirmed relationships", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page);
    await openRelationshipsModal(page);
    await switchToRelatedTab(page);

    // "Relacionado" badges should appear for confirmed relationships
    const relacionadoBadges = page.getByText("Relacionado");
    // quality: allow-fragile-selector (positional access on filtered set)
    await expect(relacionadoBadges.first()).toBeVisible({ timeout: 5000 });
  });

  test("shows relationship creator info", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page);
    await openRelationshipsModal(page);
    await switchToRelatedTab(page);

    // "Relacionado por" info should be visible for at least one doc
    await expect(page.getByText(/Relacionado por/).first()).toBeVisible({ timeout: 5000 });
  });

  test("shows tags on related documents", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page);
    await openRelationshipsModal(page);
    await switchToRelatedTab(page);

    // Tags from related documents should be visible
    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Contratos")).toBeVisible();
    await expect(page.getByText("Urgente")).toBeVisible();
  });
});

// ---------- RelatedDocumentsTab search ----------

test.describe("RelatedDocumentsTab search filtering", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("filters related documents by search query", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page);
    await openRelationshipsModal(page);
    await switchToRelatedTab(page);

    // All 3 docs should be visible initially
    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: "Poder Completado Beta" })).toBeVisible();

    // Type in the search box
    const searchInput = page.getByPlaceholder("Buscar en documentos relacionados...");
    await searchInput.fill("Alpha");

    // Only the matching doc should remain visible
    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Poder Completado Beta" })).toBeHidden();
  });

  test("shows empty state when search matches nothing", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page);
    await openRelationshipsModal(page);
    await switchToRelatedTab(page);

    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeVisible({ timeout: 5000 });

    const searchInput = page.getByPlaceholder("Buscar en documentos relacionados...");
    await searchInput.fill("ZZZZZZNOEXISTE");

    // Empty search state message
    await expect(page.getByText("No se encontraron documentos")).toBeVisible({ timeout: 5000 });
  });
});

// ---------- RelatedDocumentsTab empty state ----------

test.describe("RelatedDocumentsTab empty state", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("shows empty state when no related documents exist", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page, { withRelatedDocs: false });
    await openRelationshipsModal(page);
    await switchToRelatedTab(page);

    // Empty state message
    await expect(page.getByText("No hay documentos relacionados")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Utiliza la pestaña/).first()).toBeVisible();
  });
});

// ---------- RelatedDocumentsTab Desrelacionar button ----------

test.describe("RelatedDocumentsTab unrelate button", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("shows Desrelacionar button for each related document", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page);
    await openRelationshipsModal(page);
    await switchToRelatedTab(page);

    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeVisible({ timeout: 5000 });

    // "Desrelacionar" buttons should be visible (one per document)
    const desrelacionarBtns = page.getByRole("button", { name: "Desrelacionar" });
    const count = await desrelacionarBtns.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
