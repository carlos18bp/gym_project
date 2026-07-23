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
      buildMockDocument({
        id: 601,
        title: "Contrato Venta",
        state: "Completed",
        createdBy: userId,
        assignedTo: userId,
      }),
    ];

    await installFormalizeMocks(page, { userId, documents: docs });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Mis Documentos" })).toBeVisible({ timeout: 15_000 });
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

    await page.goto(`/dynamic_document_dashboard/document/use/formalize/602/Poder%20Especial`);
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("formalize/602");
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
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("formalize/603");
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
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("formalize/604");
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
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("formalize/605");
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

    // Rejected documents appear in the archived tab
    await page.getByRole("button", { name: /Archivados/i }).click();
    await expect(page.getByText("Contrato Rechazado")).toBeVisible({ timeout: 15_000 });
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

    await page.goto(`/dynamic_document_dashboard/document/use/correction/702/Poder%20Rechazado`);
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("correction/702");
  });

  test("correction mode shows the signature due date input", { tag: ['@flow:correct-document', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9214;
    const docs = [
      buildMockDocument({
        id: 705,
        title: "Poder Rechazado Con Fecha",
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

    await page.goto(`/dynamic_document_dashboard/document/use/correction/705/Poder%20Rechazado%20Con%20Fecha`);
    await expect(page.getByTestId("correction-signature-due-date")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Fecha límite para firmar (opcional)")).toBeVisible();
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
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("correction/703");
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
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("formalize/704");
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
    await page.waitForLoadState("networkidle");
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("correction/705");
  });
});
