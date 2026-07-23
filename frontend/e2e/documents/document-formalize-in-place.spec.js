import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
  installFormalizeMocks,
} from "../helpers/dynamicDocumentMocks.js";
import {
  openFormalizeFromMyDocuments,
  openCorrectionFromArchived,
  selectFormalizeSigner,
} from "../helpers/documentActions.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * E2E tests for in-place formalization (Completed → PendingSignatures on same document)
 * and correction (Rejected/Expired → PendingSignatures on same document).
 * Covers: formalize-in-place, correct-document flows.
 *
 * Every test drives the real entry points: the dashboard tab, the row click,
 * the actions modal and the DocumentForm submit button. The formalize/correct
 * POST payload IS the product contract, so it is asserted from the request the
 * browser actually emitted.
 */

const LAWYER_AUTH = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
});


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
    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await expect(page.getByRole("button", { name: "Mis Documentos" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Mis Documentos" }).click();

    const row = page.getByRole("table").getByText("Contrato Venta");
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();

    await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("document-action-formalize")).toBeEnabled();
  });

  test("formalize navigates to DocumentForm in formalize mode", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9201;
    const docs = [
      buildMockDocument({
        id: 602,
        title: "Poder Especial",
        state: "Completed",
        createdBy: userId,
        assignedTo: userId,
        content: "<p>Contenido del poder</p>",
      }),
    ];

    await installFormalizeMocks(page, { userId, documents: docs });
    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await page.getByRole("button", { name: "Mis Documentos" }).click();
    const row = page.getByRole("table").getByText("Poder Especial");
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("document-action-formalize").click();

    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("/document/use/formalize/602");
    await expect(page.getByRole("heading", { name: "Poder Especial" })).toBeVisible();
    await expect(page.getByText("Seleccionar usuarios que deben firmar")).toBeVisible();
  });

  test("formalize endpoint returns same document ID with PendingSignatures state", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9202;
    const docs = [
      buildMockDocument({
        id: 603,
        title: "Acuerdo Confidencialidad",
        state: "Completed",
        createdBy: userId,
        assignedTo: userId,
        content: "<p>NDA Content</p>",
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      // Stateful: the same document row flips to PendingSignatures, so the
      // dashboard the user lands on reflects the mutation.
      formalizeHandler: (route) => {
        const body = route.request().postDataJSON();
        docs[0].state = "PendingSignatures";
        docs[0].requires_signature = true;
        docs[0].fully_signed = false;
        docs[0].signature_due_date = body.signature_due_date;
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(docs[0]),
        };
      },
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await openFormalizeFromMyDocuments(page, "Acuerdo Confidencialidad");
    await selectFormalizeSigner(page, { query: "Client", userId: userId + 1 });

    const formalizeRequest = page.waitForRequest(
      (request) => request.url().includes("/dynamic-documents/603/formalize/") && request.method() === "POST"
    );
    await page.getByTestId("document-form-submit").click();
    await formalizeRequest;

    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Documento formalizado y listo para firmas", { timeout: 15_000 });
    await page.locator(".swal2-confirm").click(); // quality: allow-fragile-selector (SweetAlert2 renders no role/testid on its confirm button)

    // The redirect carries the SAME id back, which is the in-place guarantee.
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("openSignaturesFor=603");
    expect(docs[0].state).toBe("PendingSignatures");
  });

  test("formalize call sends signers array in POST body", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9203;
    const docs = [
      buildMockDocument({
        id: 604,
        title: "Mandato",
        state: "Completed",
        createdBy: userId,
        assignedTo: userId,
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
          state: "PendingSignatures",
          requires_signature: true,
        }),
      }),
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await openFormalizeFromMyDocuments(page, "Mandato");
    await selectFormalizeSigner(page, { query: "Client", userId: userId + 1 });

    const formalizeRequest = page.waitForRequest(
      (request) => request.url().includes("/dynamic-documents/604/formalize/") && request.method() === "POST"
    );
    await page.getByTestId("document-form-submit").click();
    const payload = (await formalizeRequest).postDataJSON();

    expect(payload.signature_type).toBe("normal");
    // The picked signer plus the issuing lawyer, who is auto-appended.
    expect(payload.signers).toEqual(expect.arrayContaining([userId + 1, userId]));
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
        assignedTo: userId,
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
          state: "PendingSignatures",
          requires_signature: true,
        }),
      }),
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await openFormalizeFromMyDocuments(page, originalTitle);
    await selectFormalizeSigner(page, { query: "Client", userId: userId + 1 });

    const formalizeRequest = page.waitForRequest(
      (request) => request.url().includes("/dynamic-documents/605/formalize/") && request.method() === "POST"
    );
    await page.getByTestId("document-form-submit").click();
    const payload = (await formalizeRequest).postDataJSON();

    expect(payload.title).toBe(originalTitle);
    expect(payload.title).not.toContain("_firma");
  });

  test("formalize sends the deadline typed into the signature due date field", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9205;
    const docs = [
      buildMockDocument({
        id: 606,
        title: "Contrato Con Fecha Limite",
        state: "Completed",
        createdBy: userId,
        assignedTo: userId,
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      formalizeHandler: () => ({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...docs[0], state: "PendingSignatures", requires_signature: true }),
      }),
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    await page.goto("/dynamic_document_dashboard");
    await openFormalizeFromMyDocuments(page, "Contrato Con Fecha Limite");
    await selectFormalizeSigner(page, { query: "Client", userId: userId + 1 });
    await page.getByTestId("formalize-signature-due-date").fill(dueDate);

    const formalizeRequest = page.waitForRequest(
      (request) => request.url().includes("/dynamic-documents/606/formalize/") && request.method() === "POST"
    );
    await page.getByTestId("document-form-submit").click();
    const payload = (await formalizeRequest).postDataJSON();

    expect(payload.signature_due_date).toBe(dueDate);
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
    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

    // Rejected documents appear in the archived tab
    await page.getByRole("button", { name: /Archivados/i }).click();
    await expect(page.getByText("Contrato Rechazado")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("signatures-list-row-701").click();
    await expect(page.getByTestId("document-action-editAndResend")).toBeEnabled({ timeout: 15_000 });
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
    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await page.getByRole("button", { name: /Archivados/i }).click();
    const row = page.getByRole("table").getByText("Poder Rechazado");
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("document-action-editAndResend").click();

    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("/document/use/correction/702");
    await expect(page.getByLabel("Nombre del cliente")).toHaveValue("Juan");
    await expect(page.getByRole("button", { name: "Guardar y reenviar para firma" })).toBeVisible();
  });

  test("correction mode shows the signature due date input", { tag: ['@flow:correct-document', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9215;
    const docs = [
      buildMockDocument({
        id: 706,
        title: "Poder Rechazado Con Fecha",
        state: "Rejected",
        createdBy: userId,
        content: "<p>Contenido a corregir</p>",
        requires_signature: true,
        variables: [{ name_en: "client_name", name_es: "Nombre del cliente", value: "Juan", field_type: "input", tooltip: "" }],
      }),
    ];

    await installFormalizeMocks(page, { userId, documents: docs });
    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    await page.goto("/dynamic_document_dashboard");
    await openCorrectionFromArchived(page, "Poder Rechazado Con Fecha");

    await expect(page.getByText("Fecha límite para firmar (opcional)")).toBeVisible();
    await page.getByTestId("correction-signature-due-date").fill(dueDate);
    await expect(page.getByTestId("correction-signature-due-date")).toHaveValue(dueDate);
  });

  test("correction endpoint returns same document with PendingSignatures state", { tag: ['@flow:correct-document', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9212;

    const docs = [
      buildMockDocument({
        id: 703,
        title: "Mandato Expirado",
        state: "Expired",
        createdBy: userId,
        content: "<p>Mandato content</p>",
        requires_signature: true,
        variables: [{ name_en: "amount", name_es: "Monto", value: "100", field_type: "input", tooltip: "" }],
      }),
    ];

    await installFormalizeMocks(page, {
      userId,
      documents: docs,
      // Stateful: the same row leaves the archived tab and becomes pending.
      correctHandler: () => {
        docs[0].state = "PendingSignatures";
        docs[0].fully_signed = false;
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(docs[0]),
        };
      },
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await openCorrectionFromArchived(page, "Mandato Expirado");
    await page.getByLabel("Monto").fill("250");

    const correctRequest = page.waitForRequest(
      (request) => request.url().includes("/dynamic-documents/703/correct/") && request.method() === "POST"
    );
    await page.getByRole("button", { name: "Guardar y reenviar para firma" }).click();
    const payload = (await correctRequest).postDataJSON();

    expect(payload.variables[0].value).toBe("250");

    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Documento corregido y reenviado para firmas", { timeout: 15_000 });
    await page.locator(".swal2-confirm").click(); // quality: allow-fragile-selector (SweetAlert2 renders no role/testid on its confirm button)

    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain("openSignaturesFor=703");
    expect(docs[0].state).toBe("PendingSignatures");
  });

  test("formalize error shows notification and stays on page", { tag: ['@flow:formalize-in-place', '@module:documents', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 9213;
    const docs = [
      buildMockDocument({
        id: 704,
        title: "Doc Error Test",
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
        body: JSON.stringify({ detail: "Solo los documentos en estado Completado pueden ser formalizados." }),
      }),
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await openFormalizeFromMyDocuments(page, "Doc Error Test");
    await selectFormalizeSigner(page, { query: "Client", userId: userId + 1 });
    await page.getByTestId("document-form-submit").click();

    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Error al guardar documento", { timeout: 15_000 });
    await page.locator(".swal2-confirm").click(); // quality: allow-fragile-selector (SweetAlert2 renders no role/testid on its confirm button)
    expect(page.url()).toContain("/document/use/formalize/704");
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
      correctHandler: () => ({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ detail: "El documento fue modificado por otro usuario." }),
      }),
    });

    await setAuthLocalStorage(page, LAWYER_AUTH(userId));

    await page.goto("/dynamic_document_dashboard");
    await openCorrectionFromArchived(page, "Doc Correct Error");
    await page.getByRole("button", { name: "Guardar y reenviar para firma" }).click();

    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Error al corregir el documento para firma.", { timeout: 15_000 });
    await page.locator(".swal2-confirm").click(); // quality: allow-fragile-selector (SweetAlert2 renders no role/testid on its confirm button)
    expect(page.url()).toContain("/document/use/correction/705");
  });
});
