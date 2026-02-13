import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer sees Rejected document in Dcs. Archivados with edit-and-resend option", async ({ page }) => {
  const userId = 10200;
  const userEmail = "e2e@example.com";

  const docs = [
    buildMockDocument({
      id: 13001,
      title: "Contrato Rechazado",
      state: "Rejected",
      createdBy: userId,
      requires_signature: true,
      signatures: [
        { id: 1, signer_email: userEmail, signed: true, signer_name: "E2E Lawyer" },
        { id: 2, signer_email: "client@example.com", signed: false, signer_name: "Cliente", rejected: true, rejection_comment: "No estoy de acuerdo con las cláusulas" },
      ],
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
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, email: userEmail },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Navigate to Dcs. Archivados
  await page.getByRole("button", { name: "Dcs. Archivados" }).click();
  await expect(page.getByText("Contrato Rechazado")).toBeVisible({ timeout: 10_000 });

  // Click the document row to open actions modal
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Archived/Rejected context: should show Estado de las firmas, Editar y reenviar, and rejection reason
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Estado de las firmas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar y reenviar para firma" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver motivo del rechazo" })).toBeVisible();
});

test("lawyer sees Expired document in Dcs. Archivados with signature status", async ({ page }) => {
  const userId = 10201;
  const userEmail = "e2e@example.com";

  const docs = [
    buildMockDocument({
      id: 13011,
      title: "Poder Expirado",
      state: "Expired",
      createdBy: userId,
      requires_signature: true,
      signatures: [
        { id: 1, signer_email: userEmail, signed: true, signer_name: "E2E Lawyer" },
        { id: 2, signer_email: "client@example.com", signed: false, signer_name: "Cliente" },
      ],
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
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, email: userEmail },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Navigate to Dcs. Archivados
  await page.getByRole("button", { name: "Dcs. Archivados" }).click();
  await expect(page.getByText("Poder Expirado")).toBeVisible({ timeout: 10_000 });

  // Click the document row
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Expired context: should show Previsualizar, Gestionar Membrete, Estado de las firmas
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gestionar Membrete" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Estado de las firmas" })).toBeVisible();
  // Should NOT show Descargar PDF (only for PendingSignatures)
  await expect(page.getByRole("button", { name: "Descargar PDF" })).not.toBeVisible();
});
