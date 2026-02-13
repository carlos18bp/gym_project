import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * Mock installer for user guide deep coverage.
 * Covers: user_guide.js store (25%), UserGuideMain.vue (60%),
 * GuideNavigation.vue, ModuleGuide.vue, SearchGuide.vue,
 * RoleInfoCard.vue, QuickLinksCard.vue
 */
async function installUserGuideMocks(page, { userId, role = "client" }) {
  const user = {
    id: userId,
    first_name: "Test",
    last_name: "User",
    email: "test@example.com",
    role,
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
    has_signature: false,
  };

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1 }) };
    if (apiPath === "subscriptions/current/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    return null;
  });
}

test("lawyer sees lawyer-specific modules in guide navigation", async ({ page }) => {
  const userId = 9600;

  await installUserGuideMocks(page, { userId, role: "lawyer" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, first_name: "Test", last_name: "User" },
  });

  await page.goto("/user_guide");

  await expect(page.getByText("Manual de Usuario").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Bienvenido al Manual de Usuario")).toBeVisible({ timeout: 10_000 });

  // Lawyer should see Directorio and Intranet G&M (lawyer-only modules) in sidebar
  const sidebar = page.locator("aside");
  await expect(sidebar.getByText("Directorio")).toBeVisible();
  await expect(sidebar.getByText("Intranet G&M")).toBeVisible();
  // All roles see Procesos and Archivos Jurídicos
  await expect(sidebar.getByText("Procesos")).toBeVisible();
  await expect(sidebar.getByText("Archivos Jurídicos")).toBeVisible();
});

test("client sees client-specific modules and NOT lawyer-only modules", async ({ page }) => {
  const userId = 9601;

  await installUserGuideMocks(page, { userId, role: "client" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true, first_name: "Test", last_name: "User" },
  });

  await page.goto("/user_guide");

  await expect(page.getByText("Manual de Usuario").first()).toBeVisible({ timeout: 15_000 });

  // Client should see Agendar Cita and Organizaciones (client modules)
  const sidebar = page.locator("aside");
  await expect(sidebar.getByText("Agendar Cita")).toBeVisible();
  await expect(sidebar.getByText("Organizaciones")).toBeVisible();

  // Client should NOT see Directorio (lawyer-only)
  await expect(sidebar.getByText("Directorio")).toHaveCount(0);
  // Client should NOT see Intranet G&M (lawyer-only)
  await expect(sidebar.getByText("Intranet G&M")).toHaveCount(0);
});

test("clicking a module in sidebar shows module content with sections", async ({ page }) => {
  const userId = 9602;

  await installUserGuideMocks(page, { userId, role: "lawyer" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, first_name: "Test", last_name: "User" },
  });

  await page.goto("/user_guide");

  await expect(page.getByText("Bienvenido al Manual de Usuario")).toBeVisible({ timeout: 15_000 });

  // Click "Procesos" module in sidebar
  const sidebar = page.locator("aside");
  await sidebar.getByText("Procesos").click();

  // Welcome screen should disappear, module content should appear
  await expect(page.getByText("Bienvenido al Manual de Usuario")).toHaveCount(0);

  // Module overview content should be visible (from user_guide store initializeGuideContent)
  await expect(page.getByText("Gestión y consulta de procesos judiciales")).toBeVisible({ timeout: 10_000 });

  // Sections of the Procesos module should be listed
  await expect(page.getByText("Pestañas de Procesos")).toBeVisible();
  await expect(page.getByText("Filtros y Búsqueda")).toBeVisible();
});

test("welcome screen shows RoleInfoCard and QuickLinksCard", async ({ page }) => {
  const userId = 9603;

  await installUserGuideMocks(page, { userId, role: "client" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true, first_name: "Test", last_name: "User" },
  });

  await page.goto("/user_guide");

  await expect(page.getByText("Bienvenido al Manual de Usuario")).toBeVisible({ timeout: 15_000 });

  // RoleInfoCard should show role description
  await expect(page.getByText(/cliente/i).first()).toBeVisible();

  // QuickLinksCard should show quick navigation links with "Enlaces Rápidos" heading
  const quickLinksCard = page.locator("text=Enlaces Rápidos").locator("..");
  await expect(page.getByText("Enlaces Rápidos")).toBeVisible();
  // Client quick links: "Inicio", "Mis Procesos", "Documentos", "Solicitudes"
  await expect(quickLinksCard.getByText("Mis Procesos")).toBeVisible();
  await expect(quickLinksCard.getByText("Solicitudes")).toBeVisible();
});

test("clicking a quick link navigates to the corresponding module", async ({ page }) => {
  const userId = 9604;

  await installUserGuideMocks(page, { userId, role: "lawyer" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, first_name: "Test", last_name: "User" },
  });

  await page.goto("/user_guide");

  await expect(page.getByText("Bienvenido al Manual de Usuario")).toBeVisible({ timeout: 15_000 });

  // Click the "Inicio (Dashboard)" quick link card — targets the main content area link
  const mainContent = page.locator("main");
  await mainContent.getByText("Inicio (Dashboard)").first().click();

  // Should now show the Dashboard module content
  await expect(page.getByText("Panel principal con vista general")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Bienvenido al Manual de Usuario")).toHaveCount(0);
});
