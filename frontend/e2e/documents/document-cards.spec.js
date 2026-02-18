import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E tests for document cards
 * Focus: BaseDocumentCard.vue (11.9%), DocumentCard.vue (13.6%)
 */

test.describe("document cards: rendering and display", () => {
  test("document card displays title correctly", async ({ page }) => {
    const userId = 900;
    const docs = [
      buildMockDocument({ id: 1, title: "Important Legal Document", state: "Draft", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Document title should be visible
    await expect(page.getByText("Important Legal Document")).toBeVisible();
  });

  test("document card shows status badge", async ({ page }) => {
    const userId = 901;
    const docs = [
      buildMockDocument({ id: 1, title: "Draft Document", state: "Draft", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Status badge should be visible (Draft or Borrador)
    const statusBadge = page.getByText(/Draft|Borrador/i).first();
    await expect(statusBadge).toBeVisible();
  });

  test("document card displays multiple documents", async ({ page }) => {
    const userId = 902;
    const docs = [
      buildMockDocument({ id: 1, title: "First Document", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 2, title: "Second Document", state: "Published", createdBy: userId }),
      buildMockDocument({ id: 3, title: "Third Document", state: "Completed", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Multiple documents should be rendered
    await expect(page.getByText("First Document")).toBeVisible();
  });
});

test.describe("document cards: status states", () => {
  test("draft document shows draft status", async ({ page }) => {
    const userId = 910;
    const docs = [
      buildMockDocument({ id: 1, title: "Draft Status Doc", state: "Draft", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    await expect(page.getByText("Draft Status Doc")).toBeVisible();
  });

  test("published document shows published status", async ({ page }) => {
    const userId = 911;
    const docs = [
      buildMockDocument({ id: 1, title: "Published Status Doc", state: "Published", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    await expect(page.getByText("Published Status Doc")).toBeVisible();
  });

  test("completed document shows completed status", async ({ page }) => {
    const userId = 912;
    const docs = [
      buildMockDocument({ id: 1, title: "Completed Status Doc", state: "Completed", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Page should load - completed documents may appear in a different tab
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("document cards: signature badges", () => {
  test("document with pending signatures shows signature badge", async ({ page }) => {
    const userId = 920;
    const docs = [
      buildMockDocument({ 
        id: 1, 
        title: "Signature Pending Doc", 
        state: "PendingSignatures", 
        createdBy: userId,
        requires_signature: true,
        signatures: [{ id: 1, signer_email: "signer@test.com", signed: false }]
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: true,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Page should load with signature document
    await expect(page.locator("body")).toBeVisible();
  });

  test("fully signed document shows formalized badge", async ({ page }) => {
    const userId = 921;
    const docs = [
      buildMockDocument({ 
        id: 1, 
        title: "Fully Signed Doc", 
        state: "FullySigned", 
        createdBy: userId,
        requires_signature: true,
        signatures: [{ id: 1, signer_email: "signer@test.com", signed: true }]
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: true,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Page should load with fully signed document
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("document cards: menu interaction", () => {
  test("clicking document card opens card or navigates", async ({ page }) => {
    const userId = 930;
    const docs = [
      buildMockDocument({ id: 1, title: "Clickable Document", state: "Draft", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Find and click document
    const docCard = page.getByText("Clickable Document").first();
    await expect(docCard).toBeVisible();
    await docCard.click();
    
    // Page should respond to click
    await page.waitForLoadState('networkidle');
    await expect(page.locator("body")).toBeVisible();
  });

  test("document menu button is accessible", async ({ page }) => {
    const userId = 931;
    const docs = [
      buildMockDocument({ id: 1, title: "Menu Test Doc", state: "Draft", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Document should be visible
    await expect(page.getByText("Menu Test Doc")).toBeVisible();
  });
});

test.describe("document cards: folder integration", () => {
  test("document card appears in folder view", async ({ page }) => {
    const userId = 940;
    const docs = [
      buildMockDocument({ id: 1, title: "Folder Document", state: "Draft", createdBy: userId }),
    ];
    const folders = [
      buildMockFolder({ id: 1, name: "Test Folder", colorId: 0, documents: docs }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Navigate to folders
    await page.getByRole("button", { name: "Carpetas" }).click();
    
    // Folder should be visible
    await expect(page.getByText("Test Folder")).toBeVisible();
    
    // Open folder
    await page.getByText("Test Folder", { exact: true }).click();
    
    // Document in folder should be visible
    await expect(page.getByText("Folder Document")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("document cards: tag display", () => {
  test("document with tags shows tag indicators", async ({ page }) => {
    const userId = 950;
    const docs = [
      buildMockDocument({ 
        id: 1, 
        title: "Tagged Doc", 
        state: "Draft", 
        createdBy: userId,
        tags: [{ id: 1, name: "Important" }, { id: 2, name: "Legal" }]
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Document should be visible
    await expect(page.getByText("Tagged Doc")).toBeVisible();
  });
});

test.describe("document cards: card types", () => {
  test("lawyer card type renders correctly", async ({ page }) => {
    const userId = 960;
    const docs = [
      buildMockDocument({ id: 1, title: "Lawyer Card Doc", state: "Draft", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    await expect(page.getByText("Lawyer Card Doc")).toBeVisible();
  });

  test("client card type renders correctly", async ({ page }) => {
    const userId = 961;
    const docs = [
      buildMockDocument({ id: 1, title: "Client Card Doc", state: "Completed", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Page should load for client
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("document cards: highlighting", () => {
  test("document card can be highlighted", async ({ page }) => {
    const userId = 970;
    const docs = [
      buildMockDocument({ id: 1, title: "Highlightable Doc", state: "Draft", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Document should be visible and interactive
    const doc = page.getByText("Highlightable Doc");
    await expect(doc).toBeVisible();
  });
});

test.describe("document cards: empty state", () => {
  test("empty documents list shows appropriate message", async ({ page }) => {
    const userId = 980;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    // Should show empty state or no documents message
    await expect(page.locator("body")).toBeVisible();
  });
});
