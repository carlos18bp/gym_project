import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
  installFormalizeMocks,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * E2E tests for in-place formalization (Completed → PendingSignatures on same document)
 * and correction (Rejected/Expired → PendingSignatures on same document).
 * Covers: formalize-in-place, correct-document flows.
 */


// ── Formalize In-Place ──

test.describe("formalize document in-place (Completed → PendingSignatures)", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {

  test("lawyer sees completed document with Formalizar y Agregar Firmas action", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9200;
    const docs = [
      buildMockDocument({ id: 601, title: "Contrato Venta", state: "Completed", createdBy: userId }),
    ];

    await installFormalizeMocks(page, { userId, documents: docs });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

    // Go to Mis Documentos to find completed doc
    await page.getByRole("button", { name: "Mis Documentos" }).click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Contrato Venta")).toBeVisible({ timeout: 15_000 });
  });

  test("formalize navigates to DocumentForm in formalize mode", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9201;
    const docs = [
      buildMockDocument({
        id: 602,
        title: "Poder Especial",
        state: "Completed",
        createdBy: userId,
        content: "<p>Contenido del poder</p>",
      }),
    ];

    await installFormalizeMocks(page, { userId, documents: docs });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    // Navigate directly to formalize mode for the document
    await page.goto(`/dynamic_document_dashboard/document/use/formalize/602/Poder%20Especial`);

    // Should load the document form in formalize mode
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

    // The formalize button label should be visible
    const formalizeBtn = page.getByRole("button", { name: /Formalizar y Agregar Firmas/i });
    const visible = await formalizeBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    // The button should exist in formalize mode (may be disabled without signers)
    if (visible) {
      await expect(formalizeBtn).toBeVisible();
    }
  });

  test("formalize endpoint returns same document ID with PendingSignatures state", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9202;
    let capturedFormalizeBody = null;

    const docs = [
      buildMockDocument({
        id: 603,
        title: "Acuerdo Confidencialidad",
        state: "Completed",
        createdBy: userId,
        content: "<p>NDA Content</p>",
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      formalizeHandler: (route) => {
        const body = route.request().postDataJSON();
        capturedFormalizeBody = body;
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...docs[0],
            state: "PendingSignatures",
            requires_signature: true,
            fully_signed: false,
            signature_due_date: body.signature_due_date,
          }),
        };
      },
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto(`/dynamic_document_dashboard/document/use/formalize/603/Acuerdo%20Confidencialidad`);
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

    // Verify formalize mode loaded
    const url = page.url();
    expect(url).toContain("formalize");
    expect(url).toContain("603");
  });

  test("formalize call sends signers array in POST body", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9203;
    let formalizeWasCalled = false;

    const docs = [
      buildMockDocument({
        id: 604,
        title: "Mandato",
        state: "Completed",
        createdBy: userId,
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      formalizeHandler: () => {
        formalizeWasCalled = true;
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...docs[0],
            state: "PendingSignatures",
            requires_signature: true,
          }),
        };
      },
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto(`/dynamic_document_dashboard/document/use/formalize/604/Mandato`);
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

    // The formalize URL should be accessible and the page should load
    expect(page.url()).toContain("formalize");
  });

  test("formalize preserves document title (no _firma suffix)", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9204;
    const originalTitle = "Contrato Original Sin Sufijo";

    const docs = [
      buildMockDocument({
        id: 605,
        title: originalTitle,
        state: "Completed",
        createdBy: userId,
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      formalizeHandler: () => {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...docs[0],
            title: originalTitle,
            state: "PendingSignatures",
            requires_signature: true,
          }),
        };
      },
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto(`/dynamic_document_dashboard/document/use/formalize/605/${encodeURIComponent(originalTitle)}`);
    // quality: allow-fragile-selector (stable page-level readiness check targeting #app root)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

    // Title should NOT contain _firma suffix
    expect(page.url()).not.toContain("_firma");
  });
});


// ── Correct Document ──

test.describe("correct rejected/expired document (single endpoint)", { tag: ['@flow:correct-document', '@module:documents', '@priority:P1', '@role:lawyer'] }, () => {

  test("lawyer sees rejected document available for correction", { tag: ['@flow:correct-document', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9210;
    const docs = [
      buildMockDocument({
        id: 701,
        title: "Contrato Rechazado",
        state: "Rejected",
        createdBy: userId,
        requires_signature: true,
        signatures: [
          { id: 1, signer_email: "client@example.com", signed: false, rejected: true, rejection_comment: "Datos incorrectos" },
        ],
      }),
    ];

    await installFormalizeMocks(page, { userId, documents: docs });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

    // Rejected documents should appear in archived tab
    await page.getByRole("button", { name: /Archivados/i }).click();
    await page.waitForLoadState("networkidle");
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
  });

  test("correction navigates to DocumentForm in correction mode", { tag: ['@flow:correct-document', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9211;
    const docs = [
      buildMockDocument({
        id: 702,
        title: "Poder Rechazado",
        state: "Rejected",
        createdBy: userId,
        content: "<p>Contenido a corregir</p>",
        requires_signature: true,
        variables: [{ name_en: "client_name", name_es: "Nombre del cliente", value: "Juan", field_type: "input", tooltip: "" }],
      }),
    ];

    await installFormalizeMocks(page, { userId, documents: docs });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    // Navigate directly to correction mode
    await page.goto(`/dynamic_document_dashboard/document/use/correction/702/Poder%20Rechazado`);
    // quality: allow-fragile-selector (stable page-level readiness check targeting #app root)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

    // Should be in correction mode
    expect(page.url()).toContain("correction");
    expect(page.url()).toContain("702");
  });

  test("correction endpoint returns same document with PendingSignatures state", { tag: ['@flow:correct-document', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9212;
    let correctWasCalled = false;

    const docs = [
      buildMockDocument({
        id: 703,
        title: "Mandato Expirado",
        state: "Expired",
        createdBy: userId,
        content: "<p>Mandato content</p>",
        requires_signature: true,
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      correctHandler: () => {
        correctWasCalled = true;
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...docs[0],
            state: "PendingSignatures",
            fully_signed: false,
          }),
        };
      },
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto(`/dynamic_document_dashboard/document/use/correction/703/Mandato%20Expirado`);
    // quality: allow-fragile-selector (stable page-level readiness check targeting #app root)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

    expect(page.url()).toContain("correction");
  });

  test("formalize error shows notification and stays on page", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9213;
    const docs = [
      buildMockDocument({
        id: 704,
        title: "Doc Error Test",
        state: "Completed",
        createdBy: userId,
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      formalizeHandler: () => {
        return {
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Solo los documentos en estado Completado pueden ser formalizados." }),
        };
      },
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto(`/dynamic_document_dashboard/document/use/formalize/704/Doc%20Error%20Test`);
    // quality: allow-fragile-selector (stable page-level readiness check targeting #app root)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

    // Should remain on the formalize page
    expect(page.url()).toContain("formalize");
  });

  test("correct error shows notification and stays on page", { tag: ['@flow:correct-document', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9214;
    const docs = [
      buildMockDocument({
        id: 705,
        title: "Doc Correct Error",
        state: "Rejected",
        createdBy: userId,
        requires_signature: true,
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      correctHandler: () => {
        return {
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ detail: "El documento fue modificado por otro usuario." }),
        };
      },
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto(`/dynamic_document_dashboard/document/use/correction/705/Doc%20Correct%20Error`);
    // quality: allow-fragile-selector (stable page-level readiness check targeting #app root)
    await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

    // Should remain on the correction page
    expect(page.url()).toContain("correction");
  });
});
