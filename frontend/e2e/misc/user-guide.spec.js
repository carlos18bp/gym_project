import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * Mock installer for user guide page (requires auth).
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
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1 }) };
    if (apiPath === "subscriptions/current/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    return null;
  });
}

test("user guide page renders welcome screen with role info", async ({ page }) => {
  const userId = 9200;

  await installUserGuideMocks(page, { userId, role: "client" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true, first_name: "Test", last_name: "User", email: "test@example.com" },
  });

  await page.goto("/user_guide");
  await page.waitForLoadState("networkidle");

  // Main heading
  await expect(page.getByText("Manual de Usuario").first()).toBeVisible({ timeout: 15_000 });

  // Welcome screen should show when no module is selected
  await expect(page.getByText("Bienvenido al Manual de Usuario")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Selecciona un módulo del menú lateral para comenzar")).toBeVisible();
});
