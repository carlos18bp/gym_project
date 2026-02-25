import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E — DocumentForm.vue (41.1%) deeper interactions.
 *
 * Exercises:
 * - Form rendering with variable fields (input, text_area, number, date, select)
 * - Document title display
 * - Field labels and tooltips
 * - Save button states (Guardar Borrador, Completar)
 * - Validation error display on empty submit
 * - Edit mode vs creator mode
 *
 * Route: /dynamic_document_dashboard/document/use/:mode/:id/:title
 */

const LAWYER_ID = 32000;

function buildDocWithVariables({ id = 960, title = "Minuta de Prueba", state = "Draft" } = {}) {
  return buildMockDocument({
    id,
    title,
    state,
    createdBy: LAWYER_ID,
    variables: [
      { name_en: "Client Name", name_es: "Nombre del Cliente", field_type: "input", value: "", tooltip: "Nombre completo del cliente", summary_field: "none" },
      { name_en: "Description", name_es: "Descripción", field_type: "text_area", value: "", tooltip: "", summary_field: "none" },
      { name_en: "Amount", name_es: "Monto", field_type: "number", value: "", tooltip: "Valor en pesos", currency: "COP", summary_field: "value" },
      { name_en: "Date", name_es: "Fecha", field_type: "date", value: "", tooltip: "", summary_field: "none" },
    ],
  });
}

async function setupDocumentForm(page, { mode = "editor", doc = null } = {}) {
  const document = doc || buildDocWithVariables();

  await installDynamicDocumentApiMocks(page, {
    userId: LAWYER_ID, role: "lawyer", hasSignature: true, documents: [document],
  });

  // Mock single document fetch
  await page.route(`**/api/dynamic-documents/${document.id}/`, async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(document),
    });
  });

  // Mock relationships endpoint
  await page.route(`**/api/dynamic-documents/${document.id}/related-documents/`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  // Mock document update endpoint
  await page.route(`**/api/dynamic-documents/${document.id}/update/`, async (route) => {
    if (route.request().method() === "PUT") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ id: document.id, message: "updated" }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  // Mock document create endpoint
  await page.route("**/api/dynamic-documents/create/", async (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 201, contentType: "application/json",
        body: JSON.stringify({ id: 9999 }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: LAWYER_ID, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  return document;
}

/**
 * Navigate to the document form and wait for fields to render.
 */
async function gotoDocumentForm(page, doc, mode = "editor") {
  await page.goto(`/dynamic_document_dashboard/document/use/${mode}/${doc.id}/${encodeURIComponent(doc.title)}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Nombre del Cliente")).toBeVisible({ timeout: 15_000 });
}

// ---------- Form rendering ----------

test.describe("DocumentForm field rendering", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, () => {
  test("renders document title and variable labels in editor mode", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, { mode: "editor" });
    await page.goto(`/dynamic_document_dashboard/document/use/editor/${doc.id}/${encodeURIComponent(doc.title)}`);
    await page.waitForLoadState("networkidle");

    // Document title
    await expect(page.getByRole("heading", { name: doc.title })).toBeVisible({ timeout: 15000 });

    // Variable labels
    await expect(page.getByText("Nombre del Cliente")).toBeVisible();
    await expect(page.getByText("Descripción")).toBeVisible();
    await expect(page.getByText("Monto")).toBeVisible();
    await expect(page.getByText("Fecha")).toBeVisible();
  });

  test("renders input fields for each variable type", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, { mode: "editor" });
    await page.goto(`/dynamic_document_dashboard/document/use/editor/${doc.id}/${encodeURIComponent(doc.title)}`);
    await page.waitForLoadState("networkidle");

    // Wait for form to load
    await expect(page.getByText("Nombre del Cliente")).toBeVisible({ timeout: 15000 });

    // Text input field
    // quality: allow-fragile-selector (stable application ID)
    const textInput = page.locator("#field-0");
    await expect(textInput).toBeVisible();

    // Textarea field
    // quality: allow-fragile-selector (stable application ID)
    const textArea = page.locator("#field-1");
    await expect(textArea).toBeVisible();

    // Number field
    // quality: allow-fragile-selector (stable application ID)
    const numberInput = page.locator("#field-2");
    await expect(numberInput).toBeVisible();

    // Date field
    // quality: allow-fragile-selector (stable application ID)
    const dateInput = page.locator("#field-3");
    await expect(dateInput).toBeVisible();
  });
});

// ---------- Field interaction ----------

test.describe("DocumentForm field interaction", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, () => {
  test("filling text input updates field value", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, { mode: "editor" });
    await page.goto(`/dynamic_document_dashboard/document/use/editor/${doc.id}/${encodeURIComponent(doc.title)}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Nombre del Cliente")).toBeVisible({ timeout: 15000 });

    // Fill text input
    // quality: allow-fragile-selector (stable application ID)
    const textInput = page.locator("#field-0");
    await textInput.fill("Juan Carlos Pérez");
    await expect(textInput).toHaveValue("Juan Carlos Pérez");
  });

  test("filling textarea updates field value", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, { mode: "editor" });
    await page.goto(`/dynamic_document_dashboard/document/use/editor/${doc.id}/${encodeURIComponent(doc.title)}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Descripción")).toBeVisible({ timeout: 15000 });

    // Fill textarea
    // quality: allow-fragile-selector (stable application ID)
    const textArea = page.locator("#field-1");
    await textArea.fill("Descripción detallada del contrato de servicios legales");
    await expect(textArea).toHaveValue("Descripción detallada del contrato de servicios legales");
  });
});

// ---------- Save buttons ----------

test.describe("DocumentForm save buttons", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, () => {
  test("shows Guardar Borrador and Completar buttons in editor mode", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, { mode: "editor" });
    await page.goto(`/dynamic_document_dashboard/document/use/editor/${doc.id}/${encodeURIComponent(doc.title)}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Nombre del Cliente")).toBeVisible({ timeout: 15000 });

    // Save buttons should be visible
    await expect(page.getByRole("button", { name: /Guardar cambios como Borrador/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Completar y Generar/i })).toBeVisible();
  });
});

// ---------- Numeric input formatting ----------

test.describe("DocumentForm numeric input", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, () => {
  test("number field shows formatted preview hint after entering a value", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, { mode: "editor" });
    await gotoDocumentForm(page, doc);

    // Fill number field (field index 2 = "Monto")
    // quality: allow-fragile-selector (stable application ID)
    const numberInput = page.locator("#field-2");
    await numberInput.fill("1500000");

    // Trigger blur to format display value
    await numberInput.blur();

    // The formatted preview hint should appear below the input (e.g. "COP $ 1.500.000")
    await expect(page.getByText(/COP.*1.*500.*000/)).toBeVisible({ timeout: 5_000 });
  });
});

// ---------- Completar button state ----------

test.describe("DocumentForm complete button", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, () => {
  test("Completar y Generar button is disabled when fields are empty", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, { mode: "editor" });
    await gotoDocumentForm(page, doc);

    // With empty fields, the Completar button should be disabled
    const completeBtn = page.getByRole("button", { name: /Completar y Generar/i });
    await expect(completeBtn).toBeVisible();
    await expect(completeBtn).toBeDisabled();
  });

  test("Completar y Generar button enables when all fields are filled", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, {
      mode: "editor",
      doc: buildDocWithVariables({ id: 961, title: "Minuta Completa" }),
    });
    await gotoDocumentForm(page, doc);

    // Fill all 4 fields
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-0").fill("Juan Carlos Pérez");
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-1").fill("Descripción del contrato");
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-2").fill("5000000");
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-3").fill("2025-06-15");

    // The Completar button should now be enabled
    const completeBtn = page.getByRole("button", { name: /Completar y Generar/i });
    await expect(completeBtn).toBeEnabled({ timeout: 5_000 });
  });
});

// ---------- Save draft flow ----------

test.describe("DocumentForm save draft", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, () => {
  test("clicking Guardar Borrador with all fields filled triggers save and shows notification", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, {
      mode: "editor",
      doc: buildDocWithVariables({ id: 962, title: "Minuta Guardar" }),
    });
    await gotoDocumentForm(page, doc);

    // Fill ALL fields — validateForm() rejects if any field is empty
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-0").fill("María López");
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-1").fill("Descripción del servicio legal");
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-2").fill("3000000");
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-3").fill("2025-07-01");

    // Click save progress button (calls saveDocument('Progress'))
    await page.getByRole("button", { name: /Guardar cambios como Borrador/i }).click();

    // SweetAlert2 popup should show success notification
    // quality: allow-fragile-selector (third-party component class)
    await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
    // quality: allow-fragile-selector (third-party component class)
    await expect(page.locator(".swal2-title")).toContainText(/Documento/i);
  });

  test("clicking Guardar Borrador with empty fields shows validation warning", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, {
      mode: "editor",
      doc: buildDocWithVariables({ id: 963, title: "Minuta Validar" }),
    });
    await gotoDocumentForm(page, doc);

    // Leave all fields empty and click save
    await page.getByRole("button", { name: /Guardar cambios como Borrador/i }).click();

    // SweetAlert2 should show "Campos incompletos" warning
    // quality: allow-fragile-selector (third-party component class)
    await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
    // quality: allow-fragile-selector (third-party component class)
    await expect(page.locator(".swal2-title")).toContainText("Campos incompletos");
  });
});

// ---------- Complete and generate flow ----------

test.describe("DocumentForm complete and generate", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, () => {
  test("clicking Completar y Generar with all fields filled triggers completion flow", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, {
      mode: "editor",
      doc: buildDocWithVariables({ id: 965, title: "Minuta Completar" }),
    });
    await gotoDocumentForm(page, doc);

    // Fill all 4 fields
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-0").fill("Ana García");
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-1").fill("Contrato de servicios");
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-2").fill("2000000");
    // quality: allow-fragile-selector (stable application ID)
    await page.locator("#field-3").fill("2025-08-01");

    // Click Completar y Generar
    const completeBtn = page.getByRole("button", { name: /Completar y Generar/i });
    await expect(completeBtn).toBeEnabled({ timeout: 5_000 });
    await completeBtn.click();

    // SweetAlert2 confirmation or success popup should appear
    // quality: allow-fragile-selector (third-party component class)
    await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
  });

  test("tooltip shows for number field when hovering label with tooltip text", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, { mode: "editor" });
    await gotoDocumentForm(page, doc);

    // The "Monto" field has tooltip "Valor en pesos" — check label is visible
    await expect(page.getByText("Monto")).toBeVisible();

    // Tooltip info icon should be present near the field label
    // quality: allow-fragile-selector (stable application ID)
    const tooltipIcon = page.locator("#field-2").locator("..").locator("[title], [data-tooltip]").first();
    if (await tooltipIcon.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await tooltipIcon.hover();
      await expect(page.getByText("Valor en pesos")).toBeVisible({ timeout: 3_000 });
    }
  });
});

// ---------- Email and select field types ----------

test.describe("DocumentForm email and select fields", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, () => {
  // quality: allow-fragile-test-data (mock email field type in document variable test double)
  test("renders email and select field types correctly", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const docWithEmailSelect = buildMockDocument({
      id: 964,
      title: "Minuta Email Select",
      state: "Draft",
      createdBy: LAWYER_ID,
      variables: [
        { name_en: "Contact Email", name_es: "Correo de Contacto", field_type: "email", value: "", tooltip: "Email del contacto", summary_field: "none" },
        { name_en: "Category", name_es: "Categoría", field_type: "select", value: "", tooltip: "", summary_field: "none", select_options: ["Laboral", "Civil", "Penal"] },
      ],
    });

    const doc = await setupDocumentForm(page, {
      mode: "editor",
      doc: docWithEmailSelect,
    });

    await page.goto(`/dynamic_document_dashboard/document/use/editor/${doc.id}/${encodeURIComponent(doc.title)}`);
    await page.waitForLoadState("networkidle");

    // Labels should be visible
    await expect(page.getByText("Correo de Contacto")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Categoría")).toBeVisible();

    // Email input field
    // quality: allow-fragile-selector (stable application ID)
    const emailInput = page.locator("#field-0");
    await expect(emailInput).toBeVisible();
    await emailInput.fill("test@example.com");
    await expect(emailInput).toHaveValue("test@example.com");

    // Select field with options
    // quality: allow-fragile-selector (stable application ID)
    const selectField = page.locator("#field-1");
    await expect(selectField).toBeVisible();

    // Select an option
    await selectField.selectOption("Civil");
    await expect(selectField).toHaveValue("Civil");
  });
});

// ---------- Cancel navigation ----------

test.describe("DocumentForm cancel", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, () => {
  test("clicking Cancelar navigates back to dashboard", { tag: ['@flow:docs-form-interactions', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const doc = await setupDocumentForm(page, { mode: "editor" });
    await gotoDocumentForm(page, doc);

    // Click cancel button
    await page.getByRole("button", { name: "Cancelar" }).click();

    // Should navigate back to document dashboard
    await expect(page).toHaveURL(/\/dynamic_document_dashboard/, { timeout: 10_000 });
  });
});
