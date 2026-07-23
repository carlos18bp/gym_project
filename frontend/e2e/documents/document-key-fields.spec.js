import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDocumentEditorApiMocks,
  installTinyMceCloudStub,
} from "../helpers/documentEditorMocks.js";

/**
 * E2E tests for docs-key-fields flow.
 *
 * "Key fields" are the variables a lawyer classifies (Usuario/Contraparte,
 * Objeto, Valor, Plazo…) in DocumentVariablesConfig via the `summary_field`
 * selector. The classification drives the document summary, so these tests
 * drive the selector and assert what it changes.
 */

const userId = 8840;
const documentId = 8101;

async function openVariablesConfig(page) {
  const nowIso = new Date().toISOString();

  await installTinyMceCloudStub(page);
  await installDocumentEditorApiMocks(page, {
    userId,
    role: "lawyer",
    documentId,
    document: {
      id: documentId,
      title: "Contrato Con Campos Clave",
      state: "Draft",
      created_by: userId,
      assigned_to: null,
      code: `DOC-${documentId}`,
      // Non-empty tags stops DocumentVariablesConfig from refetching and
      // overwriting the variables set up here.
      tags: [1],
      created_at: nowIso,
      updated_at: nowIso,
      content: "<p>{{nombre_cliente}} - {{monto}} - {{notas}}</p>",
      variables: [
        { name_en: "nombre_cliente", name_es: "Nombre Cliente", field_type: "input", value: "", tooltip: "", summary_field: "none", currency: null, select_options: null },
        { name_en: "monto", name_es: "Monto", field_type: "input", value: "", tooltip: "", summary_field: "none", currency: null, select_options: null },
        { name_en: "notas", name_es: "Notas", field_type: "input", value: "", tooltip: "", summary_field: "none", currency: null, select_options: null },
      ],
    },
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto(`/dynamic_document_dashboard/lawyer/editor/edit/${documentId}`);
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/dynamic_document_dashboard\/lawyer\/variables-config/);
}

test("lawyer classifies a variable as the key Valor field", { tag: ['@flow:docs-key-fields', '@module:documents', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  await openVariablesConfig(page);

  // quality: allow-fragile-selector (stable DOM id indexed by variable position)
  const montoClassification = page.locator("#summary_field_1");
  await expect(montoClassification).toHaveValue("none");
  // quality: allow-fragile-selector (stable DOM id indexed by variable position)
  await expect(page.locator("#currency_1")).toHaveCount(0);

  await montoClassification.selectOption("value");

  await expect(montoClassification).toHaveValue("value");
  // Classifying as "Valor" reveals the currency selector and forces a numeric field.
  // quality: allow-fragile-selector (stable DOM id indexed by variable position)
  await expect(page.locator("#currency_1")).toBeVisible();
  await expect(page.locator("#field_type").nth(1)).toHaveValue("number"); // quality: allow-fragile-selector (stable DOM id shared by the field-type selects)
});

test("classifying a second variable with the same key field clears the first", { tag: ['@flow:docs-key-fields', '@module:documents', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  await openVariablesConfig(page);

  // quality: allow-fragile-selector (stable DOM id indexed by variable position)
  const first = page.locator("#summary_field_0");
  // quality: allow-fragile-selector (stable DOM id indexed by variable position)
  const second = page.locator("#summary_field_2");

  await first.selectOption("counterparty");
  await expect(first).toHaveValue("counterparty");

  // A classification is exclusive: assigning it elsewhere must release it.
  await second.selectOption("counterparty");

  await expect(second).toHaveValue("counterparty");
  await expect(first).toHaveValue("none");
});
