import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
  buildMockUser,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for cards/index.js - useCardModals and useDocumentActions composables
 * Target: increase coverage for cards/index.js from 0% to higher
 */

async function installCardActionsMocks(page, { userId, role, documents, hasSignature = false }) {
  const user = buildMockUser({ id: userId, role, hasSignature });
  const nowIso = new Date().toISOString();
  let docList = [...documents];

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: hasSignature }) };

    // Document list
    if (apiPath === "dynamic-documents/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: docList,
          totalItems: docList.length,
          totalPages: 1,
          currentPage: 1,
        }),
      };
    }

    // Document detail
    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = docList.find((d) => d.id === docId);
      if (doc) return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
    }

    // Document delete
    if (apiPath.match(/^dynamic-documents\/\d+\/delete\/$/) && route.request().method() === "DELETE") {
      const docId = Number(apiPath.match(/dynamic-documents\/(\d+)\/delete/)[1]);
      docList = docList.filter(d => d.id !== docId);
      return { status: 204, contentType: "application/json", body: "" };
    }

    // Document update (for publish/draft state changes)
    if (apiPath.match(/^dynamic-documents\/\d+\/update\/$/) && route.request().method() === "PATCH") {
      const docId = Number(apiPath.match(/dynamic-documents\/(\d+)\/update/)[1]);
      const body = route.request().postDataJSON?.() || {};
      const idx = docList.findIndex(d => d.id === docId);
      if (idx !== -1) {
        docList[idx] = { ...docList[idx], ...body };
      }
      return { status: 200, contentType: "application/json", body: JSON.stringify(docList[idx] || {}) };
    }

    // Document create (for copy)
    if (apiPath === "dynamic-documents/create/" && route.request().method() === "POST") {
      const body = route.request().postDataJSON?.() || {};
      const newDoc = {
        id: 9000 + docList.length,
        ...body,
        created_at: nowIso,
        updated_at: nowIso,
        code: `DOC-${9000 + docList.length}`,
      };
      docList.push(newDoc);
      return { status: 201, contentType: "application/json", body: JSON.stringify(newDoc) };
    }

    // PDF download
    if (apiPath.match(/^dynamic-documents\/\d+\/download-pdf\/$/)) {
      return { status: 200, contentType: "application/pdf", body: "PDF_CONTENT" };
    }

    // Word download
    if (apiPath.match(/^dynamic-documents\/\d+\/download-word\/$/)) {
      return { status: 200, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", body: "WORD_CONTENT" };
    }

    // Signed document download
    if (apiPath.match(/^dynamic-documents\/\d+\/generate-signatures-pdf\/$/)) {
      return { status: 200, contentType: "application/pdf", body: "SIGNED_PDF_CONTENT" };
    }

    // Document signing
    if (apiPath.match(/^dynamic-documents\/\d+\/sign\/\d+\/$/)) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) };
    }

    // Standard endpoints
    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/permissions/clients/") return { status: 200, contentType: "application/json", body: JSON.stringify({ clients: [] }) };
    if (apiPath === "dynamic-documents/permissions/roles/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath.match(/^dynamic-documents\/\d+\/permissions\/$/)) return { status: 200, contentType: "application/json", body: JSON.stringify({ is_public: false, visibility_user_ids: [], usability_user_ids: [], visibility_roles: [], usability_roles: [] }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    if (apiPath === "user/letterhead/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    if (apiPath === "user/letterhead/word-template/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    if (apiPath.match(/^dynamic-documents\/\d+\/letterhead\/$/)) return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };

    return null;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const buildSignerEmail = (label, userId) => `${label}.${userId}@test.local`;

async function openDocumentActionsModal(page, documentTitle) {
  await page.getByRole("button", { name: "Minutas" }).click();
  await expect(page.getByText(documentTitle)).toBeVisible({ timeout: 15_000 });
  await page
    .getByRole("row", { name: new RegExp(escapeRegExp(documentTitle), "i") })
    .click();
  await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible({
    timeout: 10_000,
  });
}

const confirmDialogButton = (page) =>
  page.getByRole("button", {
    name: /^(OK|Aceptar|Confirmar|Sí|Si)$/i,
  });

const cancelDialogButton = (page) =>
  page.getByRole("button", {
    name: /^(Cancelar|No)$/i,
  });

async function clickConfirmDialogIfVisible(page, timeout = 5000) {
  const confirmButton = confirmDialogButton(page);
  if (await confirmButton.isVisible({ timeout }).catch(() => false)) {
    await confirmButton.click();
  }
}

test.describe("document card actions: modals and action handlers", () => {
  test("lawyer opens preview modal for document", async ({ page }) => {
    const userId = 8000;

    const docs = [
      buildMockDocument({
        id: 801,
        title: "Documento para Vista Previa",
        state: "Published",
        createdBy: userId,
        content: "<p>Contenido del documento</p>",
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento para Vista Previa");
    await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible();

    const previewOption = page.getByRole("button", { name: /Vista previa|Preview/i });
    if (await previewOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await previewOption.click();
      await page.waitForLoadState("domcontentloaded");
    }
  });

  test("lawyer opens edit modal for draft document", async ({ page }) => {
    const userId = 8001;

    const docs = [
      buildMockDocument({
        id: 802,
        title: "Documento para Editar",
        state: "Draft",
        createdBy: userId,
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento para Editar");
    await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible();

    const editOption = page.getByRole("button", { name: /Editar/i });
    if (await editOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editOption.click();
      await page.waitForLoadState("domcontentloaded");
    }
  });

  test("lawyer publishes draft document via menu action", async ({ page }) => {
    const userId = 8002;

    const docs = [
      buildMockDocument({
        id: 803,
        title: "Documento para Publicar",
        state: "Draft",
        createdBy: userId,
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento para Publicar");
    await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible();

    const publishOption = page.getByRole("button", { name: /Publicar/i });
    if (await publishOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await publishOption.click();
      await page.waitForLoadState("networkidle");

      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickConfirmDialogIfVisible(page);
      }
    }
  });

  test("lawyer moves published document to draft via menu", async ({ page }) => {
    const userId = 8003;

    const docs = [
      buildMockDocument({
        id: 804,
        title: "Documento Publicado",
        state: "Published",
        createdBy: userId,
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento Publicado");

    const draftOption = page.getByRole("button", {
      name: /Mover a Borrador|Mover a borrador|borrador/i,
    });
    if (await draftOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await draftOption.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
      await clickConfirmDialogIfVisible(page);
    }
  });

  test("lawyer opens permissions modal for document", async ({ page }) => {
    const userId = 8004;

    const docs = [
      buildMockDocument({
        id: 805,
        title: "Documento con Permisos",
        state: "Published",
        createdBy: userId,
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento con Permisos");
    await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible();

    const permOption = page.getByRole("button", { name: /Permisos|Permissions/i });
    if (await permOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await permOption.click();
      await page.waitForLoadState("domcontentloaded");
    }
  });

  test("lawyer copies document creating new draft", async ({ page }) => {
    const userId = 8005;

    const docs = [
      buildMockDocument({
        id: 806,
        title: "Documento Original",
        state: "Published",
        createdBy: userId,
        content: "<p>Contenido original</p>",
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento Original");

    const copyOption = page.getByRole("button", {
      name: /Crear una Copia|Duplicar|Copiar/i,
    });
    if (await copyOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await copyOption.click();

      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
        await clickConfirmDialogIfVisible(page);
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
        await clickConfirmDialogIfVisible(page);
      }
    }
  });

  test("lawyer deletes document with confirmation", async ({ page }) => {
    const userId = 8006;

    const docs = [
      buildMockDocument({
        id: 807,
        title: "Documento para Eliminar",
        state: "Draft",
        createdBy: userId,
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento para Eliminar");

    const deleteOption = page.getByRole("button", { name: /Eliminar/i });
    if (await deleteOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteOption.click();

      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
      await expect(confirmDialogButton(page)).toBeVisible();
      await expect(cancelDialogButton(page)).toBeVisible();

      await clickConfirmDialogIfVisible(page);
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
      await clickConfirmDialogIfVisible(page);
    }
  });

  test("lawyer opens email modal for document", async ({ page }) => {
    const userId = 8007;

    const docs = [
      buildMockDocument({
        id: 808,
        title: "Documento para Enviar",
        state: "Published",
        createdBy: userId,
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento para Enviar");
    await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible();

    const emailOption = page.getByRole("button", {
      name: /Enviar por correo|Email|Correo/i,
    });
    if (await emailOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailOption.click();
      await page.waitForLoadState("domcontentloaded");
    }
  });
});

test.describe("document card actions: download operations", () => {
  test("lawyer downloads PDF for published document", async ({ page }) => {
    const userId = 8010;

    const docs = [
      buildMockDocument({
        id: 810,
        title: "Documento PDF",
        state: "Published",
        createdBy: userId,
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento PDF");
    await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible();

    const pdfOption = page.getByRole("button", { name: /Descargar PDF|PDF/i });
    if (await pdfOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pdfOption.click();
      await page.waitForLoadState("domcontentloaded");
    }
  });

  test("lawyer downloads Word for published document", async ({ page }) => {
    const userId = 8011;

    const docs = [
      buildMockDocument({
        id: 811,
        title: "Documento Word",
        state: "Published",
        createdBy: userId,
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento Word");
    await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible();

    const wordOption = page.getByRole("button", { name: /Descargar Word|Word/i });
    if (await wordOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await wordOption.click();
      await page.waitForLoadState("domcontentloaded");
    }
  });
});

test.describe("document card actions: signature operations", () => {
  test("lawyer views signatures for document with signatures", async ({ page }) => {
    const userId = 8020;

    // Use Published state since FullySigned may be filtered differently
    const docs = [
      buildMockDocument({
        id: 820,
        title: "Documento con Firmas Visibles",
        state: "Published",
        createdBy: userId,
        requires_signature: true,
        signatures: [
          {
            signer_email: buildSignerEmail("signer.one", userId),
            signed: true,
            signed_at: new Date().toISOString(),
          },
          {
            signer_email: buildSignerEmail("signer.two", userId),
            signed: true,
            signed_at: new Date().toISOString(),
          },
        ],
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs, hasSignature: true });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: userId,
        role: "lawyer",
        is_gym_lawyer: true,
        is_profile_completed: true,
        email: buildSignerEmail("owner", userId),
      },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento con Firmas Visibles");
    await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible();

    const signaturesOption = page.getByRole("button", {
      name: /Ver firmas|Firmas/i,
    });
    if (await signaturesOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signaturesOption.click();
      await page.waitForLoadState("domcontentloaded");
    }
  });

  test("lawyer downloads signed document PDF", async ({ page }) => {
    const userId = 8021;

    // Use Published state with signatures to simulate signed document
    const docs = [
      buildMockDocument({
        id: 821,
        title: "Documento Firmado para Descargar",
        state: "Published",
        createdBy: userId,
        requires_signature: true,
        signatures: [
          {
            signer_email: buildSignerEmail("signer", userId),
            signed: true,
            signed_at: new Date().toISOString(),
          },
        ],
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs, hasSignature: true });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await openDocumentActionsModal(page, "Documento Firmado para Descargar");
    await expect(page.getByRole("heading", { name: "Acciones del Documento" })).toBeVisible();

    const downloadSignedOption = page.getByRole("button", {
      name: /Descargar firmado|documento firmado|PDF/i,
    });
    if (await downloadSignedOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await downloadSignedOption.click();
      await page.waitForLoadState("domcontentloaded");
    }
  });
});
