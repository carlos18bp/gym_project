import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDocumentEditorApiMocks,
  installTinyMceCloudStub,
} from "../helpers/documentEditorMocks.js";

test("lawyer can go from DocumentEditor to Variables Config and save draft", async ({ page }) => {
  const userId = 1600;
  const documentId = 555;

  const nowIso = new Date().toISOString();

  await installTinyMceCloudStub(page);
  await installDocumentEditorApiMocks(page, {
    userId,
    role: "lawyer",
    documentId,
    document: {
      id: documentId,
      title: "Minuta Variables E2E",
      state: "Draft",
      created_by: userId,
      assigned_to: null,
      code: `DOC-${documentId}`,
      // Ensure tags is non-empty so DocumentVariablesConfig does not refetch and overwrite variables.
      tags: [1],
      created_at: nowIso,
      updated_at: nowIso,
      content: "<p>Contrato con {{counterparty}} por {{value}}</p>",
      variables: [
        {
          name_en: "counterparty",
          name_es: "",
          tooltip: "",
          field_type: "input",
          value: "",
          select_options: null,
          summary_field: "none",
          currency: null,
        },
        {
          name_en: "value",
          name_es: "",
          tooltip: "",
          field_type: "number",
          value: "",
          select_options: null,
          summary_field: "value",
          currency: "COP",
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
  await expect(page.getByRole("heading", { name: "Minuta Variables E2E" })).toBeVisible();

  // Variables should be listed by name_en
  await expect(page.getByRole("heading", { name: "counterparty" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "value" })).toBeVisible();

  // Fill required display names
  await page.locator("#name_es_0").fill("Contraparte");
  await page.locator("#name_es_1").fill("Valor");

  await page.locator("#app").getByRole("button", { name: "Guardar como borrador" }).click();

  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-popup")).toContainText("Documento guardado como borrador");
  await page.locator(".swal2-confirm").click();

  await expect(page).toHaveURL(/\/dynamic_document_dashboard/);
});
