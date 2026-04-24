import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
  installFormalizeMocks,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * E2E tests for formalize signature type exceptions: issuer_only and informative.
 * Covers: formalize-in-place flow with non-default signature_type.
 */


// ── Issuer-Only Formalization ──

test.describe("formalize document with issuer_only signature type", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {

  test("formalize issuer_only sends correct payload and returns PendingSignatures", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9220;
    let capturedBody = null;

    const docs = [
      buildMockDocument({
        id: 801,
        title: "Terminacion Unilateral",
        state: "Completed",
        createdBy: userId,
        content: "<p>Se termina el contrato</p>",
        signature_type: "normal",
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      formalizeHandler: (route) => {
        capturedBody = route.request().postDataJSON();
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...docs[0],
            state: "PendingSignatures",
            signature_type: "issuer_only",
            requires_signature: true,
            fully_signed: false,
          }),
        };
      },
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto(`/dynamic_document_dashboard/document/use/formalize/801/Terminacion%20Unilateral`);
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("formalize/801");
  });

  test("issuer_only formalized document preserves document ID", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9221;

    const docs = [
      buildMockDocument({
        id: 802,
        title: "Mandato Especial",
        state: "Completed",
        createdBy: userId,
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

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto(`/dynamic_document_dashboard/document/use/formalize/802/Mandato%20Especial`);
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("formalize/802");
  });
});


// ── Informative Formalization ──

test.describe("formalize document with informative signature type", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {

  test("formalize informative sends correct payload and returns Completed state", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9230;
    let capturedBody = null;

    const docs = [
      buildMockDocument({
        id: 901,
        title: "Aviso Informativo",
        state: "Completed",
        createdBy: userId,
        content: "<p>Documento informativo</p>",
        signature_type: "normal",
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      formalizeHandler: (route) => {
        capturedBody = route.request().postDataJSON();
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...docs[0],
            state: "Completed",
            signature_type: "informative",
            requires_signature: false,
            fully_signed: false,
          }),
        };
      },
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto(`/dynamic_document_dashboard/document/use/formalize/901/Aviso%20Informativo`);
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("formalize/901");
  });

  test("informative formalize error shows notification", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9231;

    const docs = [
      buildMockDocument({
        id: 902,
        title: "Aviso Error",
        state: "Completed",
        createdBy: userId,
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

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto(`/dynamic_document_dashboard/document/use/formalize/902/Aviso%20Error`);
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("formalize/902");
  });
});
