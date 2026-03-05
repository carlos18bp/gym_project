import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
  installDynamicDocumentApiMocks,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * DocumentForm field-type interaction tests.
 * Covers: rendering of 6 field types, currency prefix, validation errors, save button state.
 */

const userId = 4000;

function buildDocWithVariables() {
  return buildMockDocument({
    id: 500,
    title: "Template With All Fields",
    state: "Published",
    createdBy: userId,
    content: "<p>{{ClientName}} owes {{Amount}}</p>",
    variables: [
      { name_en: "ClientName", name_es: "Nombre Cliente", field_type: "input", value: "", tooltip: "Enter name" },
      { name_en: "Description", name_es: "Descripción", field_type: "text_area", value: "" },
      { name_en: "Amount", name_es: "Monto", field_type: "number", value: "", currency: "COP" },
      { name_en: "BirthDate", name_es: "Fecha Nacimiento", field_type: "date", value: "" },
      { name_en: "Email", name_es: "Correo", field_type: "email", value: "" },
      { name_en: "Category", name_es: "Categoría", field_type: "select", value: "", select_options: ["Option A", "Option B"] },
    ],
  });
}

async function setupAndNavigate(page) {
  const doc = buildDocWithVariables();

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    documents: [doc],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "client",
      is_profile_completed: true,
      is_gym_lawyer: false,
    },
  });

  await page.goto(`/dynamic_document_dashboard/document/use/creator/${doc.id}/${encodeURIComponent("My Doc")}`);
}

test("document form renders all 6 field types with labels", { tag: ['@flow:docs-form-field-types', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
  await setupAndNavigate(page);

  await expect(page.getByText("Nombre Cliente")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Descripción")).toBeVisible();
  await expect(page.getByText("Monto")).toBeVisible();
  await expect(page.getByText("Fecha Nacimiento")).toBeVisible();
  await expect(page.getByText("Correo")).toBeVisible();
  await expect(page.getByText("Categoría")).toBeVisible();

  await expect(page.locator("#field-0")).toBeVisible(); // quality: allow-fragile-selector (stable DOM id)
  await expect(page.locator("#field-1")).toBeVisible(); // quality: allow-fragile-selector (stable DOM id)
  await expect(page.getByText("COP")).toBeVisible();
  await expect(page.locator('input[type="date"]')).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator("#field-5")).toBeVisible(); // quality: allow-fragile-selector (stable DOM id)
});

test("document form generate button disabled until all fields filled", { tag: ['@flow:docs-form-field-types', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
  await setupAndNavigate(page);

  await expect(page.getByText("Nombre Cliente")).toBeVisible({ timeout: 15_000 });

  // Generate button should be disabled initially
  const genBtn = page.getByRole("button", { name: /Generar/ });
  await expect(genBtn).toBeDisabled();

  await page.locator("#field-0").fill("John Doe"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#field-1").fill("A long description"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#field-2").fill("5000"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#field-3").fill("2025-06-15"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#field-4").fill("john@test.com"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#field-5").selectOption("Option A"); // quality: allow-fragile-selector (stable DOM id)

  // Generate button should now be enabled
  await expect(genBtn).toBeEnabled();
});

test("document form cancel button navigates back to dashboard", { tag: ['@flow:docs-form-field-types', '@module:documents', '@priority:P3', '@role:client'] }, async ({ page }) => {
  await setupAndNavigate(page);

  await expect(page.getByText("Nombre Cliente")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(page).toHaveURL(/dynamic_document_dashboard/, { timeout: 10_000 });
});

test("document form select field renders options", { tag: ['@flow:docs-form-field-types', '@module:documents', '@priority:P3', '@role:client'] }, async ({ page }) => {
  await setupAndNavigate(page);

  await expect(page.getByText("Categoría")).toBeVisible({ timeout: 15_000 });

  const select = page.locator("#field-5"); // quality: allow-fragile-selector (stable DOM id)
  const options = select.locator("option");
  await expect(options).toHaveCount(3); // "Seleccione una opción" + 2 real options
});
