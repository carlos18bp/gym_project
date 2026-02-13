import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer sees pending signature documents with table columns on Dcs. Por Firmar tab", async ({ page }) => {
  const userId = 8400;

  const docs = [
    buildMockDocument({
      id: 1001,
      title: "Contrato de Servicios",
      state: "PendingSignatures",
      createdBy: userId,
      requires_signature: true,
      summary_counterpart: "Empresa ABC",
      summary_object: "Prestación de servicios",
      summary_value: "5.000.000 COP",
      summary_term: "12 meses",
      summary_subscription_date: "2025-01-15",
      summary_expiration_date: "2026-06-15",
      tags: [{ id: 1, name: "Laboral", color: "#3B82F6" }],
      signatures: [
        { id: 1, signer_email: "e2e@example.com", signed: false, signer_name: "E2E Lawyer" },
        { id: 2, signer_email: "client@example.com", signed: false, signer_name: "Cliente Test" },
      ],
    }),
    buildMockDocument({
      id: 1002,
      title: "Poder Especial",
      state: "PendingSignatures",
      createdBy: userId,
      requires_signature: true,
      summary_counterpart: "Juan Pérez",
      summary_object: "Representación legal",
      signatures: [
        { id: 3, signer_email: "e2e@example.com", signed: false, signer_name: "E2E Lawyer" },
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
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Navigate to Dcs. Por Firmar tab
  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();

  // Verify table header columns are rendered
  await expect(page.getByText("Nombre Documento")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Estado Firma")).toBeVisible();
  await expect(page.getByText("Contraparte")).toBeVisible();

  // Verify search bar is rendered
  await expect(page.locator('input[placeholder="Buscar..."]')).toBeVisible();

  // Verify export button
  await expect(page.getByRole("button", { name: /Exportar/ })).toBeVisible();

  // Verify document rows
  await expect(page.getByText("Contrato de Servicios")).toBeVisible();
  await expect(page.getByText("Poder Especial")).toBeVisible();

  // Verify signature status badge shows "Pendiente"
  await expect(page.getByText("Pendiente").first()).toBeVisible();
});

test("lawyer sees fully signed documents on Dcs. Firmados tab", async ({ page }) => {
  const userId = 8401;

  const docs = [
    buildMockDocument({
      id: 1011,
      title: "Acuerdo Firmado",
      state: "FullySigned",
      createdBy: userId,
      requires_signature: true,
      summary_counterpart: "Corp XYZ",
      summary_object: "Acuerdo comercial",
      summary_value: "10.000.000 COP",
      summary_subscription_date: "2025-02-01",
      tags: [{ id: 2, name: "Comercial", color: "#8B5CF6" }],
      signatures: [
        { id: 10, signer_email: "e2e@example.com", signed: true, signer_name: "E2E Lawyer" },
        { id: 11, signer_email: "partner@example.com", signed: true, signer_name: "Partner" },
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
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Navigate to Dcs. Firmados tab
  await page.getByRole("button", { name: "Dcs. Firmados" }).click();

  // Verify table renders with the signed document
  await expect(page.getByText("Nombre Documento")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Acuerdo Firmado")).toBeVisible();
  await expect(page.getByText("Firmado").first()).toBeVisible();
});

test("lawyer sees archived (rejected/expired) documents on Dcs. Archivados tab", async ({ page }) => {
  const userId = 8402;

  const docs = [
    buildMockDocument({
      id: 1021,
      title: "Contrato Rechazado",
      state: "Rejected",
      createdBy: userId,
      requires_signature: true,
      summary_counterpart: "Empresa Rechazadora",
      signatures: [
        { id: 20, signer_email: "e2e@example.com", signed: false, signer_name: "E2E Lawyer" },
      ],
    }),
    buildMockDocument({
      id: 1022,
      title: "Poder Expirado",
      state: "Expired",
      createdBy: userId,
      requires_signature: true,
      signatures: [
        { id: 21, signer_email: "e2e@example.com", signed: false, signer_name: "E2E Lawyer" },
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
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Navigate to Dcs. Archivados tab
  await page.getByRole("button", { name: "Dcs. Archivados" }).click();

  // Verify table renders
  await expect(page.getByText("Nombre Documento")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Contrato Rechazado")).toBeVisible();
  await expect(page.getByText("Poder Expirado")).toBeVisible();

  // Verify status badges for archived docs (use .first() since text may appear in badge + row)
  await expect(page.getByText("Rechazado").first()).toBeVisible();
  await expect(page.getByText("Expirado").first()).toBeVisible();
});

test("lawyer can use search filter on signatures table", async ({ page }) => {
  const userId = 8403;

  const docs = [
    buildMockDocument({
      id: 1031,
      title: "Contrato Alpha",
      state: "PendingSignatures",
      createdBy: userId,
      requires_signature: true,
      signatures: [
        { id: 30, signer_email: "e2e@example.com", signed: false, signer_name: "E2E Lawyer" },
      ],
    }),
    buildMockDocument({
      id: 1032,
      title: "Contrato Beta",
      state: "PendingSignatures",
      createdBy: userId,
      requires_signature: true,
      signatures: [
        { id: 31, signer_email: "e2e@example.com", signed: false, signer_name: "E2E Lawyer" },
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
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Dcs. Por Firmar" }).click();
  await expect(page.getByText("Contrato Alpha")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Contrato Beta")).toBeVisible();

  // Type in the search box to filter
  await page.locator('input[placeholder="Buscar..."]').fill("Alpha");

  // Only Alpha should be visible after filtering
  await expect(page.getByText("Contrato Alpha")).toBeVisible();
  await expect(page.getByText("Contrato Beta")).not.toBeVisible();
});
