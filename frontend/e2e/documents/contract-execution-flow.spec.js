import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import { DOCS_CONTRACT_EXECUTION } from "../helpers/flow-tags.js";

/**
 * E2E for docs-contract-execution (Req #11 — Ejecución del Contrato).
 *
 * Exercises the cuentas de cobro submodule on fully signed documents:
 * menu actions gated by the payment plan, sequential upload, lawyer
 * review (accept / mandatory-reason reject), re-upload after rejection
 * and file download. The mock keeps a mutable in-memory plan mirroring
 * the backend sequential rules.
 */

const DOC_ID = 501;
const PDF_FILE = {
  name: "cuenta_cobro.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 e2e cuenta de cobro"),
};

function buildSignedDoc({ userId, role, paymentsSummary, installments = 3 }) {
  return buildMockDocument({
    id: DOC_ID,
    title: "Contrato de Servicios con Cuotas",
    state: "FullySigned",
    createdBy: role === "lawyer" ? userId : 7777,
    assignedTo: role === "lawyer" ? 8888 : userId,
    requires_signature: true,
    summary_payment_installments: installments,
    payments_summary: paymentsSummary,
  });
}

async function loginAndOpenSignedTab(page, { userId, role, documents, paymentPlan }) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role,
    hasSignature: true,
    documents,
    paymentPlan,
    tourStatus: "recent",
  });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role,
      is_gym_lawyer: role === "lawyer",
      is_profile_completed: true,
    },
  });
  await page.goto("/dynamic_document_dashboard");

  const tabTestId =
    role === "lawyer" ? "lawyer-tab-signed-documents" : "client-tab-signed-documents";
  await page.locator(`[data-testid="${tabTestId}"]`).click();
  await expect(page.getByText("Contrato de Servicios con Cuotas")).toBeVisible({
    timeout: 15_000,
  });
}

async function openActionsModal(page) {
  await page.getByText("Contrato de Servicios con Cuotas").first().click();
  await expect(page.getByRole("button", { name: "Ver Cuentas de Cobro" })).toBeVisible();
}

test(
  "client uploads the first installment and sees it under review",
  { tag: [...DOCS_CONTRACT_EXECUTION, "@role:client"] },
  async ({ page }) => {
    const userId = 9401;
    const paymentPlan = { documentId: DOC_ID, totalInstallments: 3, records: [] };
    await loginAndOpenSignedTab(page, {
      userId,
      role: "client",
      documents: [
        buildSignedDoc({
          userId,
          role: "client",
          paymentsSummary: {
            accepted_count: 0,
            in_review: false,
            next_uploadable: 1,
            total_amount_accepted: null,
          },
        }),
      ],
      paymentPlan,
    });

    await openActionsModal(page);
    await page.getByRole("button", { name: "Subir Cuenta de Cobro" }).click();

    // Upload modal with the slot auto-selected
    const uploadModal = page.locator('[data-testid="upload-payment-modal"]');
    await expect(uploadModal).toBeVisible();
    await expect(uploadModal).toContainText("Cuota 1 de 3");

    await page.locator('[data-testid="payment-file-input"]').setInputFiles(PDF_FILE);
    await page.locator('[data-testid="payment-amount-input"]').fill("2500000");
    await page.locator('[data-testid="payment-submit"]').click();

    // Detail modal reopens with fresh state
    const detailModal = page.locator('[data-testid="payment-records-modal"]');
    await expect(detailModal).toBeVisible();
    await expect(page.locator('[data-testid="payment-slot-1"]')).toContainText(
      "Cargada · En revisión",
    );
    await expect(page.locator('[data-testid="payment-slot-2"]')).toContainText(
      "Se habilita cuando la cuota anterior sea aceptada",
    );
  },
);

test(
  "lawyer accepts an installment and the next slot becomes available",
  { tag: [...DOCS_CONTRACT_EXECUTION, "@role:lawyer"] },
  async ({ page }) => {
    const userId = 9402;
    const paymentPlan = {
      documentId: DOC_ID,
      totalInstallments: 3,
      records: [{ installment_number: 1, status: "uploaded", amount: "2500000" }],
    };
    await loginAndOpenSignedTab(page, {
      userId,
      role: "lawyer",
      documents: [
        buildSignedDoc({
          userId,
          role: "lawyer",
          paymentsSummary: {
            accepted_count: 0,
            in_review: true,
            next_uploadable: null,
            total_amount_accepted: null,
          },
        }),
      ],
      paymentPlan,
    });

    await openActionsModal(page);
    // No uploadable slot while under review
    await expect(
      page.getByRole("button", { name: "Subir Cuenta de Cobro" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Ver Cuentas de Cobro" }).click();
    const detailModal = page.locator('[data-testid="payment-records-modal"]');
    await expect(detailModal).toBeVisible();

    await page.locator('[data-testid="accept-payment-1"]').click();
    await expect(detailModal).toContainText("1/3 cuotas aceptadas");
    await expect(page.locator('[data-testid="payment-slot-1"]')).toContainText("Aceptada");
    await expect(page.locator('[data-testid="payment-slot-2"]')).toContainText(
      "Disponible para carga",
    );
    // Total accepted amounts surface in the header
    await expect(detailModal).toContainText("Total aceptado");
  },
);

test(
  "lawyer rejects with a mandatory reason and the slot can be re-uploaded",
  { tag: [...DOCS_CONTRACT_EXECUTION, "@role:lawyer"] },
  async ({ page }) => {
    const userId = 9403;
    const paymentPlan = {
      documentId: DOC_ID,
      totalInstallments: 3,
      records: [{ installment_number: 1, status: "uploaded" }],
    };
    await loginAndOpenSignedTab(page, {
      userId,
      role: "lawyer",
      documents: [
        buildSignedDoc({
          userId,
          role: "lawyer",
          paymentsSummary: {
            accepted_count: 0,
            in_review: true,
            next_uploadable: null,
            total_amount_accepted: null,
          },
        }),
      ],
      paymentPlan,
    });

    await openActionsModal(page);
    await page.getByRole("button", { name: "Ver Cuentas de Cobro" }).click();
    const detailModal = page.locator('[data-testid="payment-records-modal"]');
    await expect(detailModal).toBeVisible();

    // Reason is mandatory: confirm stays disabled until typed
    await page.locator('[data-testid="reject-payment-1"]').click();
    const confirmReject = page.locator('[data-testid="confirm-reject-payment"]');
    await expect(confirmReject).toBeDisabled();
    await page.locator('[data-testid="reject-reason-input"]').fill("Falta el concepto del cobro");
    await expect(confirmReject).toBeEnabled();
    await confirmReject.click();

    await expect(page.locator('[data-testid="payment-slot-1"]')).toContainText("Rechazada");
    await expect(
      page.locator('[data-testid="rejection-reason-1"]'),
    ).toContainText("Falta el concepto del cobro");

    // Dismiss the SweetAlert success toast (its backdrop blocks clicks)
    await page.getByRole("button", { name: "OK" }).click();

    // The slot reopens: upload again from the detail modal (lawyer on behalf)
    await page.locator('[data-testid="upload-from-detail"]').click();
    const uploadModal = page.locator('[data-testid="upload-payment-modal"]');
    await expect(uploadModal).toBeVisible();
    await expect(uploadModal).toContainText("Cuota 1 de 3");
    await page.locator('[data-testid="payment-file-input"]').setInputFiles(PDF_FILE);
    await page.locator('[data-testid="payment-submit"]').click();

    await expect(detailModal).toBeVisible();
    await expect(page.locator('[data-testid="payment-slot-1"]')).toContainText(
      "Cargada · En revisión",
    );
    // Audit trail: the previous rejection stays visible to the reviewer
    await expect(page.locator('[data-testid="payment-slot-1"]')).toContainText(
      "Rechazo anterior: Falta el concepto del cobro",
    );
  },
);

test(
  "any party can download the cuenta de cobro file",
  { tag: [...DOCS_CONTRACT_EXECUTION, "@role:client"] },
  async ({ page }) => {
    const userId = 9404;
    const paymentPlan = {
      documentId: DOC_ID,
      totalInstallments: 3,
      records: [{ installment_number: 1, status: "accepted", amount: "2500000" }],
    };
    await loginAndOpenSignedTab(page, {
      userId,
      role: "client",
      documents: [
        buildSignedDoc({
          userId,
          role: "client",
          paymentsSummary: {
            accepted_count: 1,
            in_review: false,
            next_uploadable: 2,
            total_amount_accepted: "2500000",
          },
        }),
      ],
      paymentPlan,
    });

    await openActionsModal(page);
    await page.getByRole("button", { name: "Ver Cuentas de Cobro" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.locator('[data-testid="download-payment-1"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("cuenta_cobro");
  },
);

test(
  "documents without a payment plan expose no cuentas de cobro actions",
  { tag: [...DOCS_CONTRACT_EXECUTION, "@role:client"] },
  async ({ page }) => {
    const userId = 9405;
    await loginAndOpenSignedTab(page, {
      userId,
      role: "client",
      documents: [
        buildSignedDoc({
          userId,
          role: "client",
          paymentsSummary: null,
          installments: null,
        }),
      ],
      paymentPlan: null,
    });

    await page.getByText("Contrato de Servicios con Cuotas").first().click();
    // Actions modal opens with other options but no payment actions
    await expect(page.getByRole("button", { name: "Previsualizar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver Cuentas de Cobro" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Subir Cuenta de Cobro" })).toHaveCount(0);
  },
);
