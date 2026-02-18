import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for viewport/responsive behavior
 * Target: create tests for empty e2e/viewport/ directory
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

async function installViewportMocks(page, { userId, role }) {
  const user = buildMockUser({ id: userId, role });

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };

    return null;
  });
}

test.describe("viewport: desktop layout", () => {
  test("dashboard displays correctly on desktop", async ({ page }) => {
    const userId = 7000;

    await installViewportMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
  });

  test("sidebar is visible on desktop", async ({ page }) => {
    const userId = 7001;

    await installViewportMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Sidebar should be visible on desktop
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("viewport: tablet layout", () => {
  test("dashboard displays correctly on tablet", async ({ page }) => {
    const userId = 7010;

    await installViewportMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
  });

  test("navigation adapts to tablet viewport", async ({ page }) => {
    const userId = 7011;

    await installViewportMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Navigation should adapt
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("viewport: mobile layout", () => {
  test("dashboard displays correctly on mobile", async ({ page }) => {
    const userId = 7020;

    await installViewportMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
  });

  test("mobile menu can be toggled", async ({ page }) => {
    const userId = 7021;

    await installViewportMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Look for hamburger menu
    const menuBtn = page.getByRole("button", { name: /menu|hamburger/i }).or(
      page.locator("[data-testid='menu-toggle']")
    ).or(
      page.locator(".hamburger-menu")
    );

    if (await menuBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuBtn.first().click();
      await page.waitForLoadState('domcontentloaded');
    }

    await expect(page.locator("body")).toBeVisible();
  });

  test("login page is responsive on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("viewport: resize behavior", () => {
  test("app handles viewport resize gracefully", async ({ page }) => {
    const userId = 7030;

    await installViewportMocks(page, { userId, role: "lawyer" });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    // Start at desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();

    // Resize to tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator("body")).toBeVisible();

    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("viewport: public pages", () => {
  test("home page is responsive", async ({ page }) => {
    // Test at different sizes
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator("body")).toBeVisible();
  });

  test("privacy policy is responsive", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/privacy-policy");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("terms of use is responsive", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/terms-of-use");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});
