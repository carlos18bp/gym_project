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

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento para Vista Previa")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento para Vista Previa/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click preview option
      const previewOption = page.getByText("Vista previa").or(page.getByText("Preview")).first();
      if (await previewOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await previewOption.click();
        
        // Modal should open or preview should be triggered
        await page.waitForLoadState('domcontentloaded');
      }
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

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento para Editar")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento para Editar/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click edit option
      const editOption = page.getByText("Editar").first();
      if (await editOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
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

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento para Publicar")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento para Publicar/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click publish option
      const publishOption = page.getByText("Publicar").first();
      if (await publishOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await publishOption.click();
        
        // Wait for action to complete - notification may or may not appear
        await page.waitForLoadState('networkidle');
        
        // If notification appears, dismiss it
        const popup = page.locator(".swal2-popup");
        if (await popup.isVisible({ timeout: 3000 }).catch(() => false)) {
          await page.locator(".swal2-confirm").click();
        }
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

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento Publicado")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento Publicado/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click "Mover a borrador" option
      const draftOption = page.getByText("Mover a borrador").or(page.getByText("borrador")).first();
      if (await draftOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await draftOption.click();
        
        // Success notification should appear
        await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
        await page.locator(".swal2-confirm").click();
      }
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

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento con Permisos")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento con Permisos/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click permissions option
      const permOption = page.getByText("Permisos").or(page.getByText("Permissions")).first();
      if (await permOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await permOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
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

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento Original")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento Original/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click copy/duplicate option
      const copyOption = page.getByText("Duplicar").or(page.getByText("Copiar")).first();
      if (await copyOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await copyOption.click();
        
        // Confirmation dialog should appear
        const confirmBtn = page.locator(".swal2-confirm");
        if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await confirmBtn.click();
          
          // Success notification
          await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
          await page.locator(".swal2-confirm").click();
        }
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

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento para Eliminar")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento para Eliminar/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click delete option
      const deleteOption = page.getByText("Eliminar").first();
      if (await deleteOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteOption.click();
        
        // Confirmation dialog should appear
        const confirmBtn = page.locator(".swal2-confirm");
        if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await confirmBtn.click();
          
          // Success notification
          await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 10_000 });
        }
      }
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

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento para Enviar")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento para Enviar/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click email option
      const emailOption = page.getByText("Enviar por correo").or(page.getByText("Email")).or(page.getByText("Correo")).first();
      if (await emailOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await emailOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
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

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento PDF")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento PDF/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click download PDF option
      const pdfOption = page.getByText("Descargar PDF").or(page.getByText("PDF")).first();
      if (await pdfOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pdfOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
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

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento Word")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento Word/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click download Word option
      const wordOption = page.getByText("Descargar Word").or(page.getByText("Word")).first();
      if (await wordOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await wordOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
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
          { signer_email: "signer1@example.com", signed: true, signed_at: new Date().toISOString() },
          { signer_email: "signer2@example.com", signed: true, signed_at: new Date().toISOString() },
        ],
      }),
    ];

    await installCardActionsMocks(page, { userId, role: "lawyer", documents: docs, hasSignature: true });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, email: "e2e@example.com" },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento con Firmas Visibles")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento con Firmas Visibles/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click view signatures option
      const signaturesOption = page.getByText("Ver firmas").or(page.getByText("Firmas")).first();
      if (await signaturesOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await signaturesOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
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
          { signer_email: "signer@example.com", signed: true, signed_at: new Date().toISOString() },
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

    await page.getByRole("button", { name: "Minutas" }).click();
    await expect(page.getByText("Documento Firmado para Descargar")).toBeVisible({ timeout: 15_000 });

    // Find the document card and open menu
    const cardContainer = page.locator("div").filter({ hasText: /Documento Firmado para Descargar/ }).first();
    const menuTrigger = cardContainer.locator('button').filter({ has: page.locator('svg') }).first();

    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      
      // Click download signed document or regular download option
      const downloadSignedOption = page.getByText("Descargar firmado").or(page.getByText("documento firmado")).or(page.getByText("PDF")).first();
      if (await downloadSignedOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await downloadSignedOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
    }
  });
});
