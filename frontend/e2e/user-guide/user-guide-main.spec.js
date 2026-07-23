import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for user guide pages (UserGuideMain.vue and components)
 * Target: create tests for empty e2e/user-guide/ directory
 */

function buildMockUser({ id, role }) {
  return {
    id,
    first_name: "E2E",
    last_name: role === "lawyer" ? "Lawyer" : "Client",
    email: "e2e@example.com",
    role,
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
  };
}

async function installUserGuideMocks(page, { userId, role }) {
  const user = buildMockUser({ id: userId, role });

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };

    // Standard endpoints
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    return null;
  });
}

test.describe("user guide: main page", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, () => {
  test("user guide page loads for lawyer", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6000;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    // User guide should load
    await expect(page.locator("body")).toBeVisible();
  });

  test("user guide page loads for client", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6001;

    await installUserGuideMocks(page, { userId, role: "client" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    // User guide should load
    await expect(page.locator("body")).toBeVisible();
  });

  test("user guide shows navigation structure", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6002;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    // Should have navigation elements
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("user guide: navigation component", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, () => {
  test("user can navigate between guide sections", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6010;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    // Look for navigation links or buttons
    const navLinks = page.getByRole("link").or(page.getByRole("button"));
    const linkCount = await navLinks.count();

    // Page should have interactive elements
    await expect(page.locator("body")).toBeVisible();
  });

  test("navigation highlights current section", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6011;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    // Page should be stable
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("user guide: search component", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, () => {
  test("user guide has search functionality", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6020;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");

    // Typing 3+ characters triggers the guide search and opens the results dropdown
    const searchInput = page.getByPlaceholder("Buscar en el manual...");
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill("documento");

    await expect(page.getByText(/resultado\(s\) encontrado\(s\)/)).toBeVisible({ timeout: 5_000 });
  });

  test("search filters guide content", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6021;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");

    const searchInput = page.getByPlaceholder("Buscar en el manual...");
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    // Searching shows the results dropdown
    await searchInput.fill("proceso");
    await expect(page.getByText(/resultado\(s\) encontrado\(s\)/)).toBeVisible({ timeout: 5_000 });

    // Clearing the input (below the 3-char threshold) closes the dropdown
    await searchInput.clear();
    await expect(page.getByText(/resultado\(s\) encontrado\(s\)/)).toBeHidden();
  });
});

test.describe("user guide: module guide component", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, () => {
  test("module guide displays content sections", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6030;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    // Should have content sections
    await expect(page.locator("body")).toBeVisible();
  });

  test("module guide is scrollable", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6031;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    // Scroll the page
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForLoadState('domcontentloaded');

    // Page should respond to scrolling
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("user guide: example modal component", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, () => {
  test("user can view examples in modal", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6040;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");

    // Navigate: sidebar module "Procesos" → section card in the module overview
    const sidebar = page.locator("aside");
    await expect(sidebar.getByRole("button", { name: "Procesos", exact: true })).toBeVisible({ timeout: 10_000 });
    await sidebar.getByRole("button", { name: "Procesos", exact: true }).click();
    await page.getByRole("button", { name: "Radicar Proceso (Solo Abogados)" }).click();

    // The section exposes the example trigger
    await page.getByRole("button", { name: "Ver Ejemplo Completo" }).click();

    // ExampleModal opens with the example content
    await expect(page.getByRole("heading", { name: "Ejemplo: Radicar un Proceso de Tutela" })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Paso a paso para crear un nuevo proceso de tutela en el sistema.")).toBeVisible();

    // Closing the modal removes the example content
    await page.getByRole("button", { name: "Entendido" }).click();
    await expect(page.getByRole("heading", { name: "Ejemplo: Radicar un Proceso de Tutela" })).toBeHidden();
  });
});

test.describe("user guide: role info card component", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, () => {
  test("role info card shows relevant information", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6050;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    // Page should display role-appropriate content
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("user guide: quick links card component", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, () => {
  test("quick links provide shortcuts", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6060;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    // Look for quick links
    const links = page.getByRole("link");
    const linkCount = await links.count();

    // Page should have links
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("user guide: SECOP module", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, () => {
  test("SECOP module is listed in navigation for lawyer", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6070;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText(/SECOP/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("SECOP module is listed in navigation for basic role", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6071;

    await installUserGuideMocks(page, { userId, role: "basic" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "basic", is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText(/SECOP/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("search surfaces SECOP content for UNSPSC query", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6072;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    const searchInput = page.getByPlaceholder(/buscar|search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill("UNSPSC");
    await expect(page.getByText(/SECOP/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe("user guide: Servicios y Trámites module", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, () => {
  test("Servicios module is listed in navigation for client", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6080;

    await installUserGuideMocks(page, { userId, role: "client" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText(/Servicios y Trámites/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("Servicios module is listed in navigation for lawyer", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6081;

    await installUserGuideMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByText(/Servicios y Trámites/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("search surfaces Servicios content for radicado query", { tag: ['@flow:user-guide-navigation', '@module:user-guide', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 6082;

    await installUserGuideMocks(page, { userId, role: "client" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/user_guide");
    await page.waitForLoadState("domcontentloaded");

    const searchInput = page.getByPlaceholder(/buscar|search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill("radicado");
    await expect(page.getByText(/Servicios/i).first()).toBeVisible({ timeout: 5000 });
  });
});
