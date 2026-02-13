import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

function buildMockUser({ id, role, isGymLawyer = role === "lawyer" }) {
  return {
    id,
    first_name: "E2E",
    last_name: role === "lawyer" ? "Lawyer" : "Client",
    email: "e2e@example.com",
    role,
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    created_at: new Date().toISOString(),
    is_profile_completed: true,
    is_gym_lawyer: isGymLawyer,
    has_signature: false,
  };
}

async function installBasicMocks(page, { userId, role }) {
  const me = buildMockUser({ id: userId, role });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }
    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([me]) };
    }
    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(me) };
    }
    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    }
    if (apiPath === "processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "create-activity/") {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }) };
    }
    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    return null;
  });
}

test("client accessing lawyer-only route is redirected to dashboard", async ({ page }) => {
  const userId = 5000;

  await installBasicMocks(page, { userId, role: "client" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  // directory_list requires lawyer role
  await page.goto("/directory_list");

  // Should be redirected to dashboard (not allowed for client)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
});

test("lawyer can access lawyer-only route (directory)", async ({ page }) => {
  const userId = 5001;

  await installBasicMocks(page, { userId, role: "lawyer" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/directory_list");

  // Should stay on directory_list (lawyer has access)
  await expect(page).toHaveURL(/\/directory_list/, { timeout: 15_000 });
});

test("root path redirects authenticated user to dashboard", async ({ page }) => {
  const userId = 5002;

  await installBasicMocks(page, { userId, role: "lawyer" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/");

  // Root should redirect to dashboard for authenticated users
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
});

test("unknown route redirects to sign_in for unauthenticated user", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const apiPath = url.pathname.replace(/^\/api\//, "");

    if (apiPath === "google-captcha/site-key/") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/some-nonexistent-route");

  // Should redirect to sign_in
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });
});

test("page title updates based on route", async ({ page }) => {
  const userId = 5003;

  await installBasicMocks(page, { userId, role: "lawyer" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Title should include the route meta title
  await expect(page).toHaveTitle(/Panel Principal|G&M Abogados/, { timeout: 5_000 });
});
