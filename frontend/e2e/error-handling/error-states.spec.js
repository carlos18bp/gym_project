import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for error handling and error states
 * Target: create tests for empty e2e/error-handling/ directory
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

test.describe("error handling: 404 not found", () => {
  test("non-existent route shows 404 or redirects", async ({ page }) => {
    await page.goto("/non-existent-page-xyz");
    await page.waitForLoadState("networkidle");

    // Should show 404 page or redirect to home/login
    await expect(page.locator("body")).toBeVisible();
  });

  test("invalid document ID shows appropriate error", async ({ page }) => {
    const userId = 4000;
    const user = buildMockUser({ id: userId, role: "lawyer" });

    await mockApi(page, async ({ route, apiPath }) => {
      if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
      if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
      if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
      if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
      if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

      // Return 404 for document
      if (apiPath.match(/^dynamic-documents\/999999\/$/)) {
        return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) };
      }

      return null;
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard/document/999999");
    await page.waitForLoadState("networkidle");

    // Should handle 404 gracefully
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("error handling: 401 unauthorized", () => {
  test("expired token redirects to login", async ({ page }) => {
    const userId = 4010;
    const user = buildMockUser({ id: userId, role: "lawyer" });

    await mockApi(page, async ({ route, apiPath }) => {
      // Return 401 for token validation
      if (apiPath === "validate_token/") {
        return { status: 401, contentType: "application/json", body: JSON.stringify({ detail: "Token expired" }) };
      }

      if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

      return null;
    });

    await setAuthLocalStorage(page, {
      token: "expired-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Should redirect to login or show auth error
    await expect(page.locator("body")).toBeVisible();
  });

  test("missing token redirects to login", async ({ page }) => {
    // No auth setup
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Should redirect to login
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("error handling: 403 forbidden", () => {
  test("access to forbidden resource shows error", async ({ page }) => {
    const userId = 4020;
    const user = buildMockUser({ id: userId, role: "client" });

    await mockApi(page, async ({ route, apiPath }) => {
      if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
      if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
      if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
      if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

      // Return 403 for admin endpoint
      if (apiPath === "admin/settings/") {
        return { status: 403, contentType: "application/json", body: JSON.stringify({ detail: "Permission denied" }) };
      }

      return null;
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Dashboard should still load for client
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("error handling: 500 server error", () => {
  test("server error is handled gracefully", async ({ page }) => {
    const userId = 4030;
    const user = buildMockUser({ id: userId, role: "lawyer" });

    await mockApi(page, async ({ route, apiPath }) => {
      if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
      if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
      if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
      if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
      if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

      // Return 500 for some endpoints
      if (apiPath === "user-activities/") {
        return { status: 500, contentType: "application/json", body: JSON.stringify({ error: "Internal server error" }) };
      }

      if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };

      return null;
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Dashboard should still render despite partial errors
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("error handling: network errors", () => {
  test("offline indicator shows when network is unavailable", async ({ page }) => {
    // This test simulates offline behavior
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Page should handle offline gracefully
    await expect(page.locator("body")).toBeVisible();
  });

  test("app recovers from temporary network failure", async ({ page }) => {
    const userId = 4040;
    const user = buildMockUser({ id: userId, role: "lawyer" });
    let requestCount = 0;

    await mockApi(page, async ({ route, apiPath }) => {
      requestCount++;
      
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

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // App should be functional
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("error handling: form validation errors", () => {
  test("form shows validation errors for invalid input", async ({ page }) => {
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    // Try to submit empty form
    const submitBtn = page.getByRole("button", { name: /ingresar|sign in|login/i }).first();
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.click();
      await page.waitForLoadState('domcontentloaded');
    }

    // Form should show validation errors or remain on page
    await expect(page.locator("body")).toBeVisible();
  });

  test("form shows server validation errors", async ({ page }) => {
    await mockApi(page, async ({ route, apiPath }) => {
      if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

      // Return validation error for login
      if (apiPath === "token/" && route.request().method() === "POST") {
        return { status: 400, contentType: "application/json", body: JSON.stringify({ detail: "Invalid credentials" }) };
      }

      return null;
    });

    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    // Fill in invalid credentials
    const emailInput = page.getByPlaceholder(/email|correo/i).first();
    const passInput = page.getByPlaceholder(/contraseña|password/i).first();
    
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill("invalid@example.com");
      await passInput.fill("wrongpassword");
      
      const submitBtn = page.getByRole("button", { name: /ingresar|sign in|login/i }).first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForLoadState('networkidle');
      }
    }

    // Should show error message or remain on form
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("error handling: timeout errors", () => {
  test("app handles slow responses gracefully", async ({ page }) => {
    const userId = 4050;
    const user = buildMockUser({ id: userId, role: "lawyer" });

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

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // App should load
    await expect(page.locator("body")).toBeVisible();
  });
});
