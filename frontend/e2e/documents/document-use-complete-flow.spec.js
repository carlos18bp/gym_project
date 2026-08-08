import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * E2E tests for the client use-template flow: pick a published minuta from
 * "Nuevo Documento", name the new document, and land on the variables form.
 */

function buildTemplateDoc(lawyerId) {
  return buildMockDocument({
    id: 801,
    title: "Contrato de Trabajo",
    state: "Published",
    createdBy: lawyerId,
    content: "<p>Contrato para {{nombre_empleado}}</p>",
    variables: [
      { id: 1, name_en: "nombre_empleado", name_es: "Nombre del Empleado", field_type: "input", value: "" },
      { id: 2, name_en: "cargo", name_es: "Cargo", field_type: "input", value: "" },
      { id: 3, name_en: "salario", name_es: "Salario Mensual", field_type: "number", value: "" },
    ],
  });
}

async function setupClientDashboard(page, { userId, lawyerId }) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [buildTemplateDoc(lawyerId)],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
}

test("client uses a published template and lands on the variables form", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
  await setupClientDashboard(page, { userId: 8500, lawyerId: 8501 });

  await page.getByRole("button", { name: "Nuevo Documento" }).click();

  // Published minuta is listed as an available template.
  await expect(page.getByText("Contrato de Trabajo")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Disponible", { exact: true })).toBeVisible();

  // Row click opens the use-template actions modal.
  await page.getByText("Contrato de Trabajo").click();
  await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("document-action-useTemplate").click();

  // Name the new document and continue.
  await page.getByLabel(/nombre/i).fill("Mi Contrato Laboral");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.waitForURL("**/dynamic_document_dashboard/document/use/creator/801/**", { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Mi Contrato Laboral" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Nombre del Empleado")).toBeVisible();
});

test("client document dashboard loads with correct role context", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
  await setupClientDashboard(page, { userId: 8502, lawyerId: 8503 });

  // Client tab set is rendered...
  await expect(page.getByTestId("client-tab-my-documents")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("client-tab-pending-signatures")).toBeVisible();
  await expect(page.getByTestId("client-tab-archived-documents")).toBeVisible();
  // ...while the lawyer-only "Minutas" tab must not exist for a client.
  await expect(page.getByTestId("lawyer-tab-legal-documents")).toHaveCount(0);
});

test("client sees and fills variable fields on the document form", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
  await setupClientDashboard(page, { userId: 8504, lawyerId: 8505 });

  // Navigate directly to the document form in creator mode.
  await page.goto("/dynamic_document_dashboard/document/use/creator/801/Contrato%20de%20Trabajo");

  await expect(page.getByRole("heading", { name: "Contrato de Trabajo" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Nombre del Empleado")).toBeVisible();
  await expect(page.getByText("Cargo", { exact: true })).toBeVisible();
  await expect(page.getByText("Salario Mensual")).toBeVisible();

  // Fields are interactive: fill one and verify the value sticks.
  const nameField = page.getByLabel("Nombre del Empleado");
  await nameField.fill("Juan Pérez");
  await expect(nameField).toHaveValue("Juan Pérez");

  await expect(page.getByRole("button", { name: "Generar", exact: true })).toBeVisible();
});
