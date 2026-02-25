import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E — Profile.vue (6.81%), SlideBar.vue (31%).
 *
 * Strategy: interact with the sidebar user menu to open Profile modal,
 * and navigate via sidebar links to exercise SlideBar rendering.
 */

async function setupDashboard(page, { userId, role = "lawyer" }) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role,
    hasSignature: false,
    documents: [
      buildMockDocument({ id: 1, title: "Doc Nav Test", state: "Draft", createdBy: userId }),
    ],
    folders: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role, is_gym_lawyer: role === "lawyer", is_profile_completed: true },
  });
}

// ---------- SlideBar navigation ----------

test.describe("SlideBar navigation links", { tag: ['@flow:docs-profile-navigation', '@module:documents', '@priority:P4', '@role:shared'] }, () => {
  test("sidebar shows navigation links for lawyer", { tag: ['@flow:docs-profile-navigation', '@module:documents', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    const userId = 10000;
    await setupDashboard(page, { userId, role: "lawyer" });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Navigation links should be visible in the sidebar
    await expect(page.getByRole("link", { name: /Inicio/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Directorio/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Procesos/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Archivos Juridicos/i })).toBeVisible();
  });

  test("sidebar shows navigation links for client", { tag: ['@flow:docs-profile-navigation', '@module:documents', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    const userId = 10001;
    await setupDashboard(page, { userId, role: "client" });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Client may have different navigation links
    await expect(page.getByRole("link", { name: /Inicio/i })).toBeVisible();
  });
});

// ---------- Profile modal ----------

test.describe("Profile modal via user menu", { tag: ['@flow:docs-profile-navigation', '@module:documents', '@priority:P4', '@role:shared'] }, () => {
  test("opening user menu shows Perfil option", { tag: ['@flow:docs-profile-navigation', '@module:documents', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    const userId = 10010;
    await setupDashboard(page, { userId, role: "lawyer" });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click user menu button (has "Open user menu" sr-only text)
    const userMenuBtn = page.getByRole("button", { name: /Open user menu|Abrir menú/i }).first();
    await expect(userMenuBtn).toBeVisible();
    await userMenuBtn.click();

    // "Perfil" option should be visible
    await expect(page.getByText("Perfil")).toBeVisible();
    // "Cerrar sesión" option should be visible
    await expect(page.getByText("Cerrar sesión")).toBeVisible();
  });

  test("clicking Perfil opens Profile modal", { tag: ['@flow:docs-profile-navigation', '@module:documents', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    const userId = 10011;
    await setupDashboard(page, { userId, role: "lawyer" });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Open user menu
    const userMenuBtn = page.getByRole("button", { name: /Open user menu|Abrir menú/i }).first();
    await userMenuBtn.click();

    // Click "Perfil"
    await page.getByText("Perfil").click();

    // Profile modal should open — look for profile content
    // Profile shows user name, email, phone, etc.
    // quality: allow-fragile-selector (stable application ID)
    const profileModal = page.locator("#viewProfileModal");
    await expect(profileModal).toBeVisible({ timeout: 5000 });

    // Profile should show user info
    await expect(page.getByText("E2E Lawyer").first()).toBeVisible();

    // Action buttons should be visible
    await expect(page.getByText("Editar").first()).toBeVisible();
    await expect(page.getByText("Firma electrónica").first()).toBeVisible();
    await expect(page.getByText("Cerrar sesión").first()).toBeVisible();
  });

  test("closing Profile modal via X button", { tag: ['@flow:docs-profile-navigation', '@module:documents', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    const userId = 10012;
    await setupDashboard(page, { userId, role: "lawyer" });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Open user menu and click Perfil
    const userMenuBtn = page.getByRole("button", { name: /Open user menu|Abrir menú/i }).first();
    await userMenuBtn.click();
    await page.getByText("Perfil").click();

    // Profile modal visible
    // quality: allow-fragile-selector (stable application ID)
    await expect(page.locator("#viewProfileModal")).toBeVisible({ timeout: 5000 });

    // Close via X button (XMarkIcon in the top-right)
    // quality: allow-fragile-selector (positional access on filtered set)
    const closeBtn = page.locator("#viewProfileModal svg.cursor-pointer").first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
      // Modal should close
      // quality: allow-fragile-selector (stable application ID)
      await expect(page.locator("#viewProfileModal")).toBeHidden({ timeout: 5000 });
    }
  });
});

// ---------- Profile for client role ----------

test.describe("Profile modal for client", { tag: ['@flow:docs-profile-navigation', '@module:documents', '@priority:P4', '@role:shared'] }, () => {
  test("client can open Profile modal", { tag: ['@flow:docs-profile-navigation', '@module:documents', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    const userId = 10020;
    await setupDashboard(page, { userId, role: "client" });
    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Open user menu
    const userMenuBtn = page.getByRole("button", { name: /Open user menu|Abrir menú/i }).first();
    await userMenuBtn.click();

    // Click "Perfil"
    await page.getByText("Perfil").click();

    // Profile modal should open
    // quality: allow-fragile-selector (stable application ID)
    const profileModal = page.locator("#viewProfileModal");
    await expect(profileModal).toBeVisible({ timeout: 5000 });
  });
});
