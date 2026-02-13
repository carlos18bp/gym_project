import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer clicks PendingSignatures document row in Dcs. Por Firmar and sees signature actions", async ({ page }) => {
  const userId = 9700;
  const userEmail = "e2e@example.com";

  const docs = [
    buildMockDocument({
      id: 8001,
      title: "Contrato Pendiente de Firma",
      state: "PendingSignatures",
      createdBy: userId,
      requires_signature: true,
      signatures: [
        { id: 1, signer_email: userEmail, signed: false, signer_name: "E2E Lawyer" },
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

  // Navigate to Dcs. Por Firmar
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Contrato Pendiente de Firma")).toBeVisible({ timeout: 10_000 });

  // Click the document row
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Signatures context should show: Previsualizar, Gestionar Membrete, Estado de las firmas, Firmar documento, Rechazar documento, Descargar PDF
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gestionar Membrete" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Estado de las firmas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Firmar documento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rechazar documento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeVisible();
});

test("lawyer clicks FullySigned document row in Dcs. Firmados and sees download signed document option", async ({ page }) => {
  const userId = 9701;
  const userEmail = "e2e@example.com";

  const docs = [
    buildMockDocument({
      id: 8011,
      title: "Contrato Totalmente Firmado",
      state: "FullySigned",
      createdBy: userId,
      requires_signature: true,
      signatures: [
        { id: 1, signer_email: userEmail, signed: true, signer_name: "E2E Lawyer" },
        { id: 2, signer_email: "client@example.com", signed: true, signer_name: "Cliente" },
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

  // Navigate to Dcs. Firmados
  await page.getByRole("button", { name: "Dcs. Firmados" }).click();
  await expect(page.getByText("Contrato Totalmente Firmado")).toBeVisible({ timeout: 10_000 });

  // Click the document row
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // FullySigned context should show: Previsualizar, Gestionar Membrete, Estado de las firmas, Descargar Documento firmado
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Estado de las firmas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar Documento firmado" })).toBeVisible();

  // Should NOT show "Firmar documento" since all signatures are complete
  await expect(page.getByRole("button", { name: "Firmar documento" })).not.toBeVisible();
});

test("client clicks PendingSignatures document in Dcs. Por Firmar and sees sign/reject options", async ({ page }) => {
  const userId = 9702;
  const userEmail = "client-e2e@example.com";

  const docs = [
    buildMockDocument({
      id: 8021,
      title: "Acuerdo Cliente por Firmar",
      state: "PendingSignatures",
      createdBy: 100,
      assignedTo: userId,
      requires_signature: true,
      signatures: [
        { id: 1, signer_email: "lawyer@example.com", signed: true, signer_name: "Abogado" },
        { id: 2, signer_email: userEmail, signed: false, signer_name: "Cliente E2E" },
      ],
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: true,
    documents: docs,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true, email: userEmail },
  });

  await page.goto("/dynamic_document_dashboard");

  // Navigate to Dcs. Por Firmar tab for client
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Acuerdo Cliente por Firmar")).toBeVisible({ timeout: 10_000 });

  // Click the document row
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({ timeout: 10_000 });

  // Client should see sign and reject options
  await expect(page.getByRole("button", { name: "Firmar documento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rechazar documento" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
});
