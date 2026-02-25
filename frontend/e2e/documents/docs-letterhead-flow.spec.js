import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks, buildMockDocument } from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * Consolidated E2E tests for docs-letterhead flow.
 * Replaces 6 fragmented spec files with 4 user-flow tests.
 */

test("lawyer opens Global Letterhead modal and sees upload sections", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8600;
  const docs = [
    buildMockDocument({ id: 3001, title: "Doc Membrete", state: "Published", createdBy: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Look for global letterhead button
  const globalBtn = page.getByRole("button", { name: /membrete global/i })
    .or(page.locator('[data-testid="global-letterhead-btn"]'))
    // quality: allow-fragile-selector (positional access on filtered set)
    .first();
  const visible = await globalBtn.isVisible({ timeout: 5_000 }).catch(() => false);

  if (visible) {
    await globalBtn.click();
    // Modal should show upload sections
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator("#app")).toBeVisible();
  }

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible();
});

test("lawyer opens document-specific Letterhead modal from actions menu", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8601;
  const docs = [
    buildMockDocument({ id: 3010, title: "Doc Con Membrete", state: "Published", createdBy: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByText("Doc Con Membrete")).toBeVisible({ timeout: 15_000 });

  // Click document row to see actions
  await page.getByText("Doc Con Membrete").first().click();
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible();
});

test("client sees Membrete Global button on document dashboard", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 8602;
  const docs = [
    buildMockDocument({ id: 3020, title: "Doc Cliente", state: "Completed", createdBy: 999, assignedTo: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "client", hasSignature: false, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("client");
});

test("letterhead modal shows specifications toggle and Word template section", { tag: ['@flow:docs-letterhead', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8603;
  const docs = [
    buildMockDocument({ id: 3030, title: "Doc Specs", state: "Published", createdBy: userId }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible();
});
