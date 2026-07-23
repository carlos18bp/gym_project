import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E — RelatedDocumentsTab.vue.
 *
 * Exercises:
 * - Tab switching between "Relacionar Documentos" and "Documentos Relacionados"
 * - Rendering document list with state colors/badges
 * - Search filtering within related documents
 * - "Relacionado" badge and relationship provenance
 * - "Desrelacionar" actually deleting the relationship
 * - Empty state (no related docs)
 *
 * Access path: Completed doc → ActionsModal → "Administrar Asociaciones"
 * → tab navigation inside DocumentRelationshipsModal.
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

/**
 * Stateful relationship backend: DELETE actually drops the relationship and
 * its target document, so the list the user sees after "Desrelacionar" is the
 * mutated server state and not a pre-cooked fixture.
 */
async function setupWithRelationships(page, { withRelatedDocs = true } = {}) {
  const mainDoc = buildMockDocument({
    id: 500, title: "Contrato Principal Completado", state: "Completed",
    createdBy: LAWYER_ID, assignedTo: LAWYER_ID,
  });
  mainDoc.relationships_count = withRelatedDocs ? 3 : 0;

  const docs = [mainDoc];
  const state = {
    relatedDocs: withRelatedDocs ? buildRelatedDocuments() : [],
    relationships: withRelatedDocs ? buildRelationships() : [],
  };

  await installDynamicDocumentApiMocks(page, {
    userId: LAWYER_ID, role: "lawyer", hasSignature: true, documents: docs,
  });

  await page.route("**/api/dynamic-documents/relationships/*/delete/", async (route) => {
    const relationshipId = Number(route.request().url().match(/relationships\/(\d+)\/delete/)[1]);
    const removed = state.relationships.find((rel) => rel.id === relationshipId);
    state.relationships = state.relationships.filter((rel) => rel.id !== relationshipId);
    if (removed) {
      const targetId = removed.source_document === 500 ? removed.target_document : removed.source_document;
      state.relatedDocs = state.relatedDocs.filter((doc) => doc.id !== targetId);
    }
    await route.fulfill({ status: 204, contentType: "application/json", body: "" });
  });
  await page.route("**/api/dynamic-documents/*/relationships/", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(state.relationships),
    });
  });
  await page.route("**/api/dynamic-documents/*/related-documents/", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(state.relatedDocs),
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

  return state;
}

async function openRelationshipsModal(page) {
  await page.goto("/dynamic_document_dashboard");

  // Switch to "Mis Documentos" tab where Completed docs show
  await page.getByRole("button", { name: "Mis Documentos" }).click();
  const row = page.getByRole("table").getByText("Contrato Principal Completado");
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();

  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Administrar Asociaciones" }).click();
  await expect(page.getByText("Administrar Asociaciones de Documentos")).toBeVisible({ timeout: 15_000 });
}

const relateTab = (page) => page.getByRole("button", { name: /Relacionar Documentos/ });
const relatedTab = (page) => page.getByRole("button", { name: /Documentos Relacionados/ });

async function switchToRelatedTab(page) {
  await relatedTab(page).click();
  await expect(page.getByPlaceholder("Buscar en documentos relacionados...")).toBeVisible({ timeout: 10_000 });
}

// ---------- RelatedDocumentsTab rendering ----------

test.describe("RelatedDocumentsTab renders related documents list", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("shows related document titles and state badges", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page);
    await openRelationshipsModal(page);

    // Leave the related tab so the assertions below prove the tab switch renders it.
    await relateTab(page).click();
    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeHidden();

    await relatedTab(page).click();

    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeVisible({ timeout: 10_000 });
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

    await relateTab(page).click();
    await expect(page.getByText("Relacionado", { exact: true })).toHaveCount(0);

    await relatedTab(page).click();

    // One "Relacionado" badge per confirmed relationship.
    await expect(page.getByText("Relacionado", { exact: true })).toHaveCount(3, { timeout: 10_000 });
  });

  test("shows relationship creator info", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page);
    await openRelationshipsModal(page);

    await relateTab(page).click();
    await expect(page.getByText(/Relacionado por/)).toHaveCount(0);

    await relatedTab(page).click();

    await expect(page.getByText(/Relacionado por Abogado García/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Relacionado por Abogado López/)).toBeVisible();
  });

  test("shows tags on related documents", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page);
    await openRelationshipsModal(page);

    await relateTab(page).click();
    await expect(page.getByText("Urgente")).toHaveCount(0);

    await relatedTab(page).click();

    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeVisible({ timeout: 10_000 });
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
    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeVisible({ timeout: 10_000 });
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

    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeVisible({ timeout: 10_000 });

    const searchInput = page.getByPlaceholder("Buscar en documentos relacionados...");
    await searchInput.fill("ZZZZZZNOEXISTE");

    // Empty search state message
    await expect(page.getByText("No se encontraron documentos")).toBeVisible({ timeout: 10_000 });
  });
});

// ---------- RelatedDocumentsTab empty state ----------

test.describe("RelatedDocumentsTab empty state", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("shows empty state when no related documents exist", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    await setupWithRelationships(page, { withRelatedDocs: false });
    await openRelationshipsModal(page);
    await switchToRelatedTab(page);

    // Empty state message
    await expect(page.getByText("No hay documentos relacionados")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Utiliza la pestaña/).first()).toBeVisible();
  });
});

// ---------- RelatedDocumentsTab Desrelacionar button ----------

test.describe("RelatedDocumentsTab unrelate button", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, () => {
  test("Desrelacionar drops the relationship and removes the document from the list", { tag: ['@flow:docs-relationships', '@module:documents', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const state = await setupWithRelationships(page);
    await openRelationshipsModal(page);
    await switchToRelatedTab(page);

    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeVisible({ timeout: 10_000 });
    const unrelateButtons = page.getByRole("button", { name: "Desrelacionar" });
    await expect(unrelateButtons).toHaveCount(3);

    const deleteRequest = page.waitForRequest(
      (request) => request.url().includes("/dynamic-documents/relationships/1001/delete/") && request.method() === "DELETE"
    );
    await page.getByTestId("unrelate-document-601").click();
    await deleteRequest;

    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Relación eliminada exitosamente", { timeout: 15_000 });
    await page.locator(".swal2-confirm").click(); // quality: allow-fragile-selector (SweetAlert2 renders no role/testid on its confirm button)

    await expect(page.getByRole("heading", { name: "Contrato Firmado Alpha" })).toBeHidden({ timeout: 10_000 });
    await expect(unrelateButtons).toHaveCount(2);
    expect(state.relationships.map((rel) => rel.id)).toEqual([1002, 1003]);
  });
});
