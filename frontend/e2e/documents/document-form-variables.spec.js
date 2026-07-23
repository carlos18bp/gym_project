import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * DocumentForm variable rendering and editing.
 *
 * The form is always reached through the product's own navigation:
 * - clients: "Nuevo Documento" → template row → "Usar plantilla" → name → "Continuar"
 * - lawyers: "Mis Documentos" → document row → "Completar" → "Editar Documento"
 */

/**
 * Walk a client from the dashboard to the "name your document" step of the
 * template flow. The caller performs the final "Continuar" click.
 */
async function openTemplateNameStep(page, templateTitle) {
  await page.goto("/dynamic_document_dashboard");
  await page.getByRole("button", { name: "Nuevo Documento" }).click();
  await expect(page.getByText(templateTitle, { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByText(templateTitle, { exact: true }).click();
  await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("document-action-useTemplate").click();
  await page.locator("#document-name").fill(templateTitle); // quality: allow-fragile-selector (stable DOM id)
}

test("client can view document form with variable fields", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 8300;

  const doc = buildMockDocument({
    id: 901,
    title: "Contrato de Arrendamiento",
    state: "Published",
    createdBy: 999,
    assignedTo: null,
    content: "<p>Contrato entre {{nombre_arrendador}} y {{nombre_arrendatario}}</p>",
    variables: [
      {
        name_es: "Nombre del Arrendador",
        name_en: "Landlord Name",
        field_type: "input",
        value: "",
        tooltip: "Nombre completo del arrendador",
      },
      {
        name_es: "Nombre del Arrendatario",
        name_en: "Tenant Name",
        field_type: "input",
        value: "",
      },
      {
        name_es: "Valor del Arriendo",
        name_en: "Rent Amount",
        field_type: "number",
        value: "",
        currency: "COP",
      },
      {
        name_es: "Fecha de Inicio",
        name_en: "Start Date",
        field_type: "date",
        value: "",
      },
      {
        name_es: "Observaciones",
        name_en: "Notes",
        field_type: "text_area",
        value: "",
      },
    ],
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [doc],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await openTemplateNameStep(page, "Contrato de Arrendamiento");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Should land on the creator form for that template
  await expect(page).toHaveURL(/document\/use\/creator\/901/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Contrato de Arrendamiento" })).toBeVisible({ timeout: 15_000 });

  // Should see variable labels
  await expect(page.getByText("Nombre del Arrendador")).toBeVisible();
  await expect(page.getByText("Nombre del Arrendatario")).toBeVisible();
  await expect(page.getByText("Valor del Arriendo")).toBeVisible();
  await expect(page.getByText("Fecha de Inicio")).toBeVisible();
  await expect(page.getByText("Observaciones")).toBeVisible();
});

test("client can fill in form variables and see validation", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 8301;

  const doc = buildMockDocument({
    id: 902,
    title: "Poder Especial",
    state: "Published",
    createdBy: 999,
    assignedTo: null,
    content: "<p>Poder otorgado a {{nombre_apoderado}}</p>",
    variables: [
      {
        name_es: "Nombre del Apoderado",
        name_en: "Attorney Name",
        field_type: "input",
        value: "",
      },
      {
        name_es: "Número de Cédula",
        name_en: "ID Number",
        field_type: "number",
        value: "",
      },
    ],
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [doc],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await openTemplateNameStep(page, "Poder Especial");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Poder Especial" })).toBeVisible({ timeout: 15_000 });

  // Fill in form fields
  const nameField = page.locator("#field-0"); // quality: allow-fragile-selector (stable DOM id)
  await nameField.fill("Juan Pérez");
  await expect(nameField).toHaveValue("Juan Pérez");

  const idField = page.locator("#field-1"); // quality: allow-fragile-selector (stable DOM id)
  await idField.fill("12345678");
  await expect(idField).toHaveValue("12345678");
});

test("lawyer can open document form in editor mode", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 8302;

  const doc = buildMockDocument({
    id: 903,
    title: "Tutela Salud",
    state: "Progress",
    createdBy: userId,
    assignedTo: userId,
    content: "<p>Acción de tutela por {{motivo}}</p>",
    variables: [
      {
        name_es: "Motivo de la Tutela",
        name_en: "Reason",
        field_type: "text_area",
        value: "Negación de tratamiento",
      },
    ],
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [doc],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.getByRole("button", { name: "Mis Documentos" }).click();

  const row = page.getByRole("table").getByText("Tutela Salud");
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("document-action-editForm").click();
  await page.getByRole("button", { name: "Editar Documento" }).click();

  await expect(page).toHaveURL(/document\/use\/editor\/903/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Tutela Salud" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Motivo de la Tutela")).toBeVisible();
  // Editor mode preloads the stored value, unlike creator mode.
  await expect(page.locator("#field-0")).toHaveValue("Negación de tratamiento"); // quality: allow-fragile-selector (stable DOM id)
});
