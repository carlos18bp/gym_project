import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDocumentEditorApiMocks,
  installTinyMceCloudStub,
} from "../helpers/documentEditorMocks.js";

/**
 * DocumentVariablesConfig interaction tests.
 * Covers: navigation from editor, rendering, summary classification → currency reveal.
 * Complements document-variables-config-flow.spec.js (save-as-draft happy path).
 */

const userId = 4100;
const documentId = 600;

async function setupAndNavigateToConfig(page) {
  const nowIso = new Date().toISOString();

  await installTinyMceCloudStub(page);
  await installDocumentEditorApiMocks(page, {
    userId,
    documentId,
    document: {
      id: documentId,
      title: "Minuta Interactions E2E",
      state: "Draft",
      created_by: userId,
      assigned_to: null,
      code: `DOC-${documentId}`,
      // Non-empty tags prevents DocumentVariablesConfig from refetching and
      // overwriting the variables we set up here.
      tags: [1],
      created_at: nowIso,
      updated_at: nowIso,
      content: "<p>{{Field1}} - {{Field2}}</p>",
      variables: [
        {
          name_en: "Field1",
          name_es: "Campo Uno",
          field_type: "input",
          value: "",
          tooltip: "",
          summary_field: "none",
          currency: null,
          select_options: null,
        },
        {
          name_en: "Field2",
          name_es: "Campo Dos",
          field_type: "number",
          value: "",
          tooltip: "",
          summary_field: "none",
          currency: null,
          select_options: null,
        },
      ],
    },
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "lawyer",
      is_gym_lawyer: true,
      is_profile_completed: true,
    },
  });

  await page.goto(`/dynamic_document_dashboard/lawyer/editor/edit/${documentId}`);
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/dynamic_document_dashboard\/lawyer\/variables-config/);
}

test("variables config page renders variables and action buttons", { tag: ['@flow:docs-variables-config', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  await setupAndNavigateToConfig(page);

  // Title from the mocked document.
  await expect(page.getByRole("heading", { name: "Minuta Interactions E2E" })).toBeVisible();

  // Both variables are listed by their English name.
  await expect(page.getByRole("heading", { name: "Field1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Field2" })).toBeVisible();

  // Action buttons for the save/publish/cancel flow. Scoped to #app because
  // the layout may render a duplicate mobile footer.
  // quality: allow-fragile-selector (stable application ID)
  const app = page.locator("#app");
  await expect(app.getByRole("button", { name: "Guardar como borrador" }).first()).toBeVisible();
  await expect(app.getByRole("button", { name: "Publicar" }).first()).toBeVisible();
  await expect(app.getByRole("button", { name: "Cancelar" }).first()).toBeVisible();
});

test("variables config: selecting 'Valor' classification reveals currency selector", { tag: ['@flow:docs-variables-config', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  await setupAndNavigateToConfig(page);

  // The second variable (index 1) starts as 'Sin clasificar'.
  // quality: allow-fragile-selector (stable DOM id indexed by variable position)
  const summarySelect = page.locator("#summary_field_1");
  await expect(summarySelect).toBeVisible();

  // Currency selector must NOT exist yet (v-if guard).
  // quality: allow-fragile-selector (stable DOM id indexed by variable position)
  await expect(page.locator("#currency_1")).toHaveCount(0);

  // Classify as 'Valor' → currency selector should appear.
  await summarySelect.selectOption("value");
  // quality: allow-fragile-selector (stable DOM id indexed by variable position)
  await expect(page.locator("#currency_1")).toBeVisible();

  // COP, USD, EUR plus the empty "Sin moneda" option = 4 total.
  await expect(page.locator("#currency_1 option")).toHaveCount(4);
});
