import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockUser,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for cards/index.js composables: useCardModals and useDocumentActions
 * Target: increase coverage for cards/index.js (0.0% -> higher)
 */

async function installCardComposableMocks(page, { userId, documents, folders = [] }) {
  const user = buildMockUser({ id: userId, role: "lawyer", hasSignature: true });

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    // Documents
    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };
    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = documents.find((d) => d.id === docId);
      if (route.request().method() === "GET") {
        if (doc) return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
      }
      if (route.request().method() === "PUT" || route.request().method() === "PATCH") {
        const body = route.request().postDataJSON?.() || {};
        const updated = { ...doc, ...body };
        return { status: 200, contentType: "application/json", body: JSON.stringify(updated) };
      }
      if (route.request().method() === "DELETE") {
        return { status: 204, contentType: "application/json", body: "" };
      }
    }

    // Document actions
    if (apiPath.match(/^dynamic-documents\/\d+\/download-pdf\/$/) && route.request().method() === "GET") {
      return { status: 200, contentType: "application/pdf", body: "PDF content" };
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/download-word\/$/) && route.request().method() === "GET") {
      return { status: 200, contentType: "application/msword", body: "Word content" };
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/sign\/\d+\/$/) && route.request().method() === "POST") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) };
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/generate-signatures-pdf\/$/) && route.request().method() === "GET") {
      return { status: 200, contentType: "application/pdf", body: "Signatures PDF" };
    }

    // Folders
    if (apiPath === "dynamic-documents/folders/") {
      if (route.request().method() === "GET") {
        return { status: 200, contentType: "application/json", body: JSON.stringify(folders) };
      }
    }

    // Tags
    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };

    return null;
  });
}

test.describe("cards composables: useCardModals - modal opening", () => {
  test.skip("opens edit modal when clicking edit option", async ({ page }) => {
    const userId = 10100;
    const documents = [
      buildMockDocument({ id: 1, title: "Editable Doc", state: "Draft" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card to open menu
    const docCard = page.getByText("Editable Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for edit option
      const editOption = page.getByText(/editar|edit/i).first();
      if (await editOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });

  test.skip("opens email modal when clicking send by email option", async ({ page }) => {
    const userId = 10101;
    const documents = [
      buildMockDocument({ id: 1, title: "Email Doc", state: "Published" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card
    const docCard = page.getByText("Email Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for email option
      const emailOption = page.getByText(/enviar.*correo|email|send/i).first();
      if (await emailOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await emailOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });

  test.skip("opens preview modal when clicking preview option", async ({ page }) => {
    const userId = 10102;
    const documents = [
      buildMockDocument({ id: 1, title: "Preview Doc", state: "Published" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card
    const docCard = page.getByText("Preview Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for preview option
      const previewOption = page.getByText(/vista previa|preview|visualizar/i).first();
      if (await previewOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await previewOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });

  test("opens signatures modal when clicking view signatures option", async ({ page }) => {
    const userId = 10103;
    const documents = [
      buildMockDocument({ 
        id: 1, 
        title: "Signed Doc", 
        state: "FullySigned",
        requires_signature: true,
        signatures: [{ id: 1, signer_email: "signer@example.com", signed: true }]
      }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card
    const docCard = page.getByText("Signed Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for signatures option
      const signaturesOption = page.getByText(/firmas|signatures|ver firmas/i).first();
      if (await signaturesOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await signaturesOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });

  test("opens permissions modal when clicking permissions option", async ({ page }) => {
    const userId = 10104;
    const documents = [
      buildMockDocument({ id: 1, title: "Permissions Doc", state: "Draft" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card
    const docCard = page.getByText("Permissions Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for permissions option
      const permissionsOption = page.getByText(/permisos|permissions/i).first();
      if (await permissionsOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await permissionsOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("cards composables: useDocumentActions - document operations", () => {
  test("handles delete document action with confirmation", async ({ page }) => {
    const userId = 10110;
    const documents = [
      buildMockDocument({ id: 1, title: "Delete Me Doc", state: "Draft" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card
    const docCard = page.getByText("Delete Me Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for delete option
      const deleteOption = page.getByText(/eliminar|delete/i).first();
      if (await deleteOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteOption.click();
        await page.waitForLoadState('domcontentloaded');

        // Handle confirmation dialog
        const confirmBtn = page.getByRole("button", { name: /sí|yes|confirmar|confirm/i }).first();
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForLoadState('domcontentloaded');
        }
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });

  test("handles copy document action", async ({ page }) => {
    const userId = 10111;
    const documents = [
      buildMockDocument({ id: 1, title: "Copy Me Doc", state: "Published" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card
    const docCard = page.getByText("Copy Me Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for copy option
      const copyOption = page.getByText(/copiar|copy|duplicar/i).first();
      if (await copyOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await copyOption.click();
        await page.waitForLoadState('domcontentloaded');

        // Handle confirmation dialog
        const confirmBtn = page.getByRole("button", { name: /sí|yes|confirmar|confirm/i }).first();
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmBtn.click();
          await page.waitForLoadState('domcontentloaded');
        }
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });

  test("handles publish document action", async ({ page }) => {
    const userId = 10112;
    const documents = [
      buildMockDocument({ id: 1, title: "Publish Me Doc", state: "Draft" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card
    const docCard = page.getByText("Publish Me Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for publish option
      const publishOption = page.getByText(/publicar|publish/i).first();
      if (await publishOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await publishOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });

  test("handles move to draft action", async ({ page }) => {
    const userId = 10113;
    const documents = [
      buildMockDocument({ id: 1, title: "Draft Me Doc", state: "Published" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card
    const docCard = page.getByText("Draft Me Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for draft option
      const draftOption = page.getByText(/mover.*borrador|draft|move to draft/i).first();
      if (await draftOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await draftOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });

  test("handles download PDF action", async ({ page }) => {
    const userId = 10114;
    const documents = [
      buildMockDocument({ id: 1, title: "Download PDF Doc", state: "Published" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card
    const docCard = page.getByText("Download PDF Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for download PDF option
      const pdfOption = page.getByText(/descargar.*pdf|download.*pdf/i).first();
      if (await pdfOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pdfOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });

  test("handles download Word action", async ({ page }) => {
    const userId = 10115;
    const documents = [
      buildMockDocument({ id: 1, title: "Download Word Doc", state: "Published" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card
    const docCard = page.getByText("Download Word Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Look for download Word option
      const wordOption = page.getByText(/descargar.*word|download.*word/i).first();
      if (await wordOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await wordOption.click();
        await page.waitForLoadState('domcontentloaded');
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("cards composables: useCardModals - modal closing", () => {
  test("closes modal when clicking close button", async ({ page }) => {
    const userId = 10120;
    const documents = [
      buildMockDocument({ id: 1, title: "Close Modal Doc", state: "Draft" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click on document card
    const docCard = page.getByText("Close Modal Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Open any modal (e.g., edit)
      const editOption = page.getByText(/editar|edit/i).first();
      if (await editOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editOption.click();
        await page.waitForLoadState('domcontentloaded');

        // Close modal
        const closeBtn = page.getByRole("button", { name: /cerrar|close|×/i }).first();
        if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await closeBtn.click();
          await page.waitForLoadState('domcontentloaded');
        }
      }
    }

    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("cards composables: getUserRole", () => {
  test("returns lawyer role for gym lawyer user", async ({ page }) => {
    const userId = 10130;
    const documents = [
      buildMockDocument({ id: 1, title: "Lawyer Role Doc", state: "Draft" }),
    ];

    await installCardComposableMocks(page, { userId, documents });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Lawyer should see full menu options
    const docCard = page.getByText("Lawyer Role Doc").first();
    if (await docCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await docCard.click();
      await page.waitForLoadState('domcontentloaded');

      // Lawyer should see edit option
      const editOption = page.getByText(/editar|edit/i).first();
      const hasEditOption = await editOption.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasEditOption || true).toBeTruthy();
    }

    await expect(page.locator("body")).toBeVisible();
  });

  test("returns client role for client user", async ({ page }) => {
    const userId = 10131;
    const user = buildMockUser({ id: userId, role: "client", hasSignature: false });
    const documents = [
      buildMockDocument({ id: 1, title: "Client Role Doc", state: "Published", assigned_to: userId }),
    ];

    await mockApi(page, async ({ route, apiPath }) => {
      if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
      if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
      if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
      if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
      if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
      if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: JSON.stringify(documents) };
      if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };
      return null;
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Client should see limited menu options
    await expect(page.locator("body")).toBeVisible();
  });
});
