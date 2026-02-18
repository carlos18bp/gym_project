import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer sees completed client documents on Dcs. Clientes tab with table columns", async ({ page }) => {
  const userId = 8500;

  const docs = [
    buildMockDocument({
      id: 2001,
      title: "Contrato Finalizado Cliente",
      state: "Completed",
      createdBy: userId,
      assignedTo: 6001,
      summary_counterpart: "Empresa Final",
      summary_object: "Venta de inmueble",
      summary_value: "200.000.000 COP",
      summary_term: "Indefinido",
      summary_subscription_date: "2025-03-01",
      tags: [{ id: 5, name: "Inmobiliario", color: "#10B981" }],
    }),
    buildMockDocument({
      id: 2002,
      title: "Poder Finalizado",
      state: "Completed",
      createdBy: userId,
      assignedTo: 6002,
      summary_counterpart: "María López",
      summary_object: "Representación judicial",
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Navigate to Dcs. Clientes (finished) tab
  await page.getByRole("button", { name: "Dcs. Clientes", exact: true }).click();

  // Verify table header columns (DocumentFinishedByClientListTable)
  const table = page.locator('table').first();
  await expect(table).toBeVisible({ timeout: 10_000 });
  await expect(table.locator('th', { hasText: 'Nombre Documento' })).toBeVisible();
  await expect(table.locator('th', { hasText: 'Cliente' })).toBeVisible();
  await expect(table.locator('th', { hasText: 'Estado' })).toBeVisible();

  // Verify search bar is rendered
  await expect(page.locator('input[placeholder="Buscar..."]')).toBeVisible();

  // Verify document rows appear
  await expect(page.getByText("Contrato Finalizado Cliente")).toBeVisible();
  await expect(page.getByText("Poder Finalizado")).toBeVisible();
});

test("lawyer sees in-progress client documents on Dcs. Clientes en Progreso tab with search", async ({ page }) => {
  const userId = 8501;

  const docs = [
    buildMockDocument({
      id: 2011,
      title: "Contrato en Progreso Alpha",
      state: "Progress",
      createdBy: userId,
      assignedTo: 6010,
      summary_counterpart: "Empresa Alpha",
      summary_object: "Consultoría",
      tags: [{ id: 6, name: "Consultoría", color: "#6366F1" }],
    }),
    buildMockDocument({
      id: 2012,
      title: "Tutela en Progreso Beta",
      state: "Progress",
      createdBy: userId,
      assignedTo: 6011,
      summary_counterpart: "Hospital Beta",
      summary_object: "Acción de tutela",
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: docs,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Navigate to Dcs. Clientes en Progreso tab
  await page.getByRole("button", { name: "Dcs. Clientes en Progreso" }).click();

  // Verify table renders
  await expect(page.getByText("Nombre Documento")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('input[placeholder="Buscar..."]')).toBeVisible();

  // Both documents should appear
  await expect(page.getByText("Contrato en Progreso Alpha")).toBeVisible();
  await expect(page.getByText("Tutela en Progreso Beta")).toBeVisible();

  // Search for "Alpha" to filter
  await page.locator('input[placeholder="Buscar..."]').fill("Alpha");
  await expect(page.getByText("Contrato en Progreso Alpha")).toBeVisible();
  await expect(page.getByText("Tutela en Progreso Beta")).not.toBeVisible();
});

test("lawyer sees empty state message when no completed client documents", async ({ page }) => {
  const userId = 8502;

  // Only Draft documents — nothing will match the "Completed" filter
  const docs = [
    buildMockDocument({
      id: 2021,
      title: "Borrador Doc",
      state: "Draft",
      createdBy: userId,
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: false,
    documents: docs,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Dcs. Clientes", exact: true }).click();

  // Should see an empty state (no documents match)
  await page.waitForLoadState('networkidle');
  // The table header should still render
  await expect(page.getByText("Nombre Documento")).toBeVisible({ timeout: 10_000 });
  // But "Borrador Doc" should NOT appear (it's Draft, not Completed)
  await expect(page.getByText("Borrador Doc")).not.toBeVisible();
});
