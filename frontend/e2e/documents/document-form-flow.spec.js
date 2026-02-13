import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

test("client can start document from template and see form variables", async ({ page }) => {
  const userId = 8000;
  const templateId = 501;

  const template = buildMockDocument({
    id: templateId,
    title: "Contrato de Arrendamiento",
    state: "Published",
    createdBy: 999,
    assignedTo: null,
    content: "<p>Contrato</p>",
    variables: [
      {
        name_en: "name",
        name_es: "Nombre completo",
        field_type: "input",
        value: "",
        tooltip: "Nombre del arrendatario",
        select_options: null,
        summary_field: "none",
        currency: null,
      },
    ],
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [template],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Click "Nuevo Documento" tab
  await page.getByRole("button", { name: "Nuevo Documento" }).click();

  // Should show the published template
  await expect(page.getByText("Contrato de Arrendamiento")).toBeVisible({ timeout: 10_000 });

  // Click on the template
  await page.getByText("Contrato de Arrendamiento", { exact: true }).click();

  // Enter document name
  const nameInput = page.locator("#document-name");
  await expect(nameInput).toBeVisible({ timeout: 10_000 });
  await nameInput.fill("Mi Contrato");

  // Click continue
  await page.getByRole("button", { name: "Continuar" }).click();

  // Should navigate to the document form with the variables
  await expect(page).toHaveURL(/\/dynamic_document_dashboard\/document\/use/, { timeout: 15_000 });

  // The document form should render the heading
  await expect(page.getByRole("heading", { name: "Mi Contrato" })).toBeVisible({ timeout: 15_000 });
});

test("client sees published templates in Nuevo Documento tab", async ({ page }) => {
  const userId = 8001;

  const templates = [
    buildMockDocument({
      id: 601,
      title: "Plantilla Demanda",
      state: "Published",
      createdBy: 999,
      assignedTo: null,
    }),
    buildMockDocument({
      id: 602,
      title: "Plantilla Tutela",
      state: "Published",
      createdBy: 999,
      assignedTo: null,
    }),
    buildMockDocument({
      id: 603,
      title: "Documento en Progreso",
      state: "Progress",
      createdBy: 999,
      assignedTo: userId,
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: templates,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // Click "Nuevo Documento" tab
  await page.getByRole("button", { name: "Nuevo Documento" }).click();

  // Should show published templates
  await expect(page.getByText("Plantilla Demanda")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Plantilla Tutela")).toBeVisible();

  // Progress documents should NOT appear in templates
  await expect(page.getByText("Documento en Progreso")).toBeHidden();
});
