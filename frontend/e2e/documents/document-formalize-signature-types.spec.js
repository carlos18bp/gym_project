import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
  installFormalizeMocks,
} from "../helpers/dynamicDocumentMocks.js";
import {
  openFormalizeFromMyDocuments,
  selectFormalizeRecipient,
} from "../helpers/documentActions.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * E2E tests for formalize signature type exceptions: issuer_only and informative.
 * Covers: formalize-in-place flow with non-default signature_type.
 *
 * Each test picks the signature type radio and the recipients through the real
 * form, then asserts the payload the browser emitted — the payload IS the
 * contract that decides which backend branch runs.
 */

const LAWYER_AUTH = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
});


// ── Issuer-Only Formalization ──

test.describe("formalize document with issuer_only signature type", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {

  test("formalize issuer_only sends correct payload and returns PendingSignatures", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9220;

    const docs = [
      buildMockDocument({
        id: 801,
        title: "Terminacion Unilateral",
        state: "Completed",
        createdBy: userId,
        assignedTo: userId,
        content: "<p>Se termina el contrato</p>",
        signature_type: "normal",
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      formalizeHandler: () => {
        docs[0].state = "PendingSignatures";
        docs[0].signature_type = "issuer_only";
        docs[0].requires_signature = true;
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(docs[0]),
        };
      },
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await openFormalizeFromMyDocuments(page, "Terminacion Unilateral");

    await page.getByTestId("formalize-signature-type-issuer-only").check();
    await expect(page.getByRole("button", { name: "Formalizar y Firmar" })).toBeVisible();
    await selectFormalizeRecipient(page, { query: "Client", userId: userId + 1 });

    const formalizeRequest = page.waitForRequest(
      (request) => request.url().includes("/dynamic-documents/801/formalize/") && request.method() === "POST"
    );
    await page.getByTestId("document-form-submit").click();
    const payload = (await formalizeRequest).postDataJSON();

    expect(payload.signature_type).toBe("issuer_only");
    expect(payload.recipients).toEqual([userId + 1]);
    expect(payload.signers).toBeUndefined();

    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Documento formalizado. Pendiente de su firma.", { timeout: 15_000 });
    expect(docs[0].state).toBe("PendingSignatures");
  });

  test("issuer_only formalized document preserves document ID", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9221;

    const docs = [
      buildMockDocument({
        id: 802,
        title: "Mandato Especial",
        state: "Completed",
        createdBy: userId,
        assignedTo: userId,
        content: "<p>Mandato content</p>",
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      formalizeHandler: () => ({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...docs[0],
          id: 802,
          state: "PendingSignatures",
          signature_type: "issuer_only",
          requires_signature: true,
        }),
      }),
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await openFormalizeFromMyDocuments(page, "Mandato Especial");
    await page.getByTestId("formalize-signature-type-issuer-only").check();
    await selectFormalizeRecipient(page, { query: "Client", userId: userId + 1 });
    await page.getByTestId("document-form-submit").click();

    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Documento formalizado. Pendiente de su firma.", { timeout: 15_000 });
    await page.locator(".swal2-confirm").click(); // quality: allow-fragile-selector (SweetAlert2 renders no role/testid on its confirm button)

    // Same id in the redirect query proves the formalization happened in place.
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("openSignaturesFor=802");
  });
});


// ── Informative Formalization ──

test.describe("formalize document with informative signature type", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {

  test("formalize informative sends correct payload and returns Completed state", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9230;

    const docs = [
      buildMockDocument({
        id: 901,
        title: "Aviso Informativo",
        state: "Completed",
        createdBy: userId,
        assignedTo: userId,
        content: "<p>Documento informativo</p>",
        signature_type: "normal",
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      formalizeHandler: () => {
        docs[0].signature_type = "informative";
        docs[0].requires_signature = false;
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(docs[0]),
        };
      },
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await openFormalizeFromMyDocuments(page, "Aviso Informativo");

    await page.getByTestId("formalize-signature-type-informative").check();
    // Informative documents never ask for a signing deadline.
    await expect(page.getByTestId("formalize-signature-due-date")).toBeHidden();
    await selectFormalizeRecipient(page, { query: "Client", userId: userId + 1 });

    const formalizeRequest = page.waitForRequest(
      (request) => request.url().includes("/dynamic-documents/901/formalize/") && request.method() === "POST"
    );
    await page.getByRole("button", { name: "Enviar como Documento Informativo" }).click();
    const payload = (await formalizeRequest).postDataJSON();

    expect(payload.signature_type).toBe("informative");
    expect(payload.recipients).toEqual([userId + 1]);
    expect(payload.signature_due_date).toBeNull();

    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Documento informativo enviado a los destinatarios", { timeout: 15_000 });
    await page.locator(".swal2-confirm").click(); // quality: allow-fragile-selector (SweetAlert2 renders no role/testid on its confirm button)

    // Informative documents stay Completed, so the user goes back to my-documents.
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("tab=my-documents");
    expect(docs[0].state).toBe("Completed");
  });

  test("informative formalize error shows notification", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9231;

    const docs = [
      buildMockDocument({
        id: 902,
        title: "Aviso Error",
        state: "Completed",
        createdBy: userId,
        assignedTo: userId,
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      formalizeHandler: () => ({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Debe indicar al menos un destinatario." }),
      }),
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await openFormalizeFromMyDocuments(page, "Aviso Error");
    await page.getByTestId("formalize-signature-type-informative").check();
    await selectFormalizeRecipient(page, { query: "Client", userId: userId + 1 });
    await page.getByRole("button", { name: "Enviar como Documento Informativo" }).click();

    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Error al guardar documento", { timeout: 15_000 });
    await page.locator(".swal2-confirm").click(); // quality: allow-fragile-selector (SweetAlert2 renders no role/testid on its confirm button)
    expect(page.url()).toContain("/document/use/formalize/902");
  });
});
