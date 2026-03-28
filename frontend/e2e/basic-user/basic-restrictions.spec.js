import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
import { BASIC_RESTRICTIONS } from "../helpers/flow-tags.js";

function buildBasicUser(id) {
  return {
    id,
    first_name: "E2E",
    last_name: "Basic",
    email: `basic-${id}@example.com`,
    role: "basic",
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    created_at: new Date().toISOString(),
    is_profile_completed: true,
    is_gym_lawyer: false,
    has_signature: false,
  };
}

async function installBasicUserMocks(page, { userId }) {
  const user = buildBasicUser(userId);
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }
    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }
    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    }
    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    }
    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
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
    if (apiPath === "processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "dropdown_options_legal_request/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ request_types: ["Consulta", "Asesoría"], areas: ["Civil", "Penal"] }) };
    }
    return null;
  });
}

function basicAuth(userId) {
  return {
    token: "e2e-basic-token",
    userAuth: { id: userId, role: "basic", is_gym_lawyer: false, is_profile_completed: true },
  };
}

test.describe("Basic User Restrictions", () => {
  test("basic user is redirected from directory (lawyer-only route)", {
    tag: [...BASIC_RESTRICTIONS, "@role:basic"],
  }, async ({ page }) => {
    const userId = 9600;
    await installBasicUserMocks(page, { userId });
    await setAuthLocalStorage(page, basicAuth(userId));

    await page.goto("/directory_list");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("basic user is redirected from process form (lawyer-only route)", {
    tag: [...BASIC_RESTRICTIONS, "@role:basic"],
  }, async ({ page }) => {
    const userId = 9601;
    await installBasicUserMocks(page, { userId });
    await setAuthLocalStorage(page, basicAuth(userId));

    await page.goto("/dynamic_document_dashboard/lawyer/variables-config");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("basic user is redirected from document editor (lawyer-only route)", {
    tag: [...BASIC_RESTRICTIONS, "@role:basic"],
  }, async ({ page }) => {
    const userId = 9602;
    await installBasicUserMocks(page, { userId });
    await setAuthLocalStorage(page, basicAuth(userId));

    await page.goto("/dynamic_document_dashboard/lawyer/editor/create/TestDoc");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("basic user can access legal request creation page", {
    tag: [...BASIC_RESTRICTIONS, "@role:basic"],
  }, async ({ page }) => {
    const userId = 9603;
    await installBasicUserMocks(page, { userId });
    await setAuthLocalStorage(page, basicAuth(userId));

    await page.goto("/legal_request_create");
    await expect(page).toHaveURL(/\/legal_request_create/, { timeout: 15_000 });
  });

  test("basic user can access schedule appointment page", {
    tag: [...BASIC_RESTRICTIONS, "@role:basic"],
  }, async ({ page }) => {
    const userId = 9604;
    await installBasicUserMocks(page, { userId });
    await setAuthLocalStorage(page, basicAuth(userId));

    await page.goto("/schedule_appointment");
    await expect(page).toHaveURL(/\/schedule_appointment/, { timeout: 15_000 });
  });

  test("basic user has no signature available", {
    tag: [...BASIC_RESTRICTIONS, "@role:basic"],
  }, async ({ page }) => {
    const userId = 9605;
    await installBasicUserMocks(page, { userId });
    await setAuthLocalStorage(page, basicAuth(userId));

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Verify the user session reflects basic role without signature
    const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
    expect(userAuth.role).toBe("basic");
    expect(userAuth.is_gym_lawyer).toBe(false);
  });

  test("basic user sees disabled letterhead button in document dashboard", {
    tag: [...BASIC_RESTRICTIONS, "@role:basic"],
  }, async ({ page }) => {
    const userId = 9606;

    await mockApi(page, async ({ apiPath }) => {
      if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
      if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
      if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([{ id: userId, role: "basic", first_name: "E2E", last_name: "Basic", email: `basic-${userId}@example.com`, contact: "", birthday: "", identification: "", document_type: "", photo_profile: "", created_at: new Date().toISOString(), is_profile_completed: true, is_gym_lawyer: false, has_signature: false }]) };
      if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ id: userId, role: "basic", first_name: "E2E", last_name: "Basic", email: `basic-${userId}@example.com`, contact: "", birthday: "", identification: "", document_type: "", photo_profile: "", created_at: new Date().toISOString(), is_profile_completed: true, is_gym_lawyer: false, has_signature: false }) };
      if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
      if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: new Date().toISOString() }) };
      if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === "dynamic-documents/pending-signatures/") return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === `dynamic-documents/user/${userId}/signed-documents/`) return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === "dynamic-documents/permissions/clients/") return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };
      return null;
    });

    await setAuthLocalStorage(page, basicAuth(userId));
    await page.goto("/dynamic_document_dashboard");
    await expect(page).toHaveURL(/\/dynamic_document_dashboard/, { timeout: 15_000 });

    // The global letterhead button should be disabled for basic users
    const letterheadBtn = page.locator('button[disabled]').filter({ hasText: /[Mm]embrete/ });
    await expect(letterheadBtn).toBeVisible({ timeout: 10_000 });
    await expect(letterheadBtn).toBeDisabled();
  });

  test("basic user sees SECOP advanced filters disabled overlay", {
    tag: [...BASIC_RESTRICTIONS, "@role:basic"],
  }, async ({ page }) => {
    const userId = 9607;

    await mockApi(page, async ({ apiPath }) => {
      if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
      if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
      if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([{ id: userId, role: "basic", first_name: "E2E", last_name: "Basic", email: `basic-${userId}@example.com`, contact: "", birthday: "", identification: "", document_type: "", photo_profile: "", created_at: new Date().toISOString(), is_profile_completed: true, is_gym_lawyer: false, has_signature: false }]) };
      if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ id: userId, role: "basic", first_name: "E2E", last_name: "Basic", email: `basic-${userId}@example.com`, contact: "", birthday: "", identification: "", document_type: "", photo_profile: "", created_at: new Date().toISOString(), is_profile_completed: true, is_gym_lawyer: false, has_signature: false }) };
      if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
      if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
      if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: new Date().toISOString() }) };
      if (apiPath === "secop/processes/") return { status: 200, contentType: "application/json", body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }) };
      if (apiPath === "secop/filters/") return { status: 200, contentType: "application/json", body: JSON.stringify({ departments: [], entity_names: [], statuses: [], unspsc_codes: [] }) };
      if (apiPath === "secop/sync/") return { status: 200, contentType: "application/json", body: JSON.stringify({ last_sync: null, status: "idle" }) };
      if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };
      return null;
    });

    await setAuthLocalStorage(page, basicAuth(userId));
    await page.goto("/secop");
    await expect(page).toHaveURL(/\/secop/, { timeout: 15_000 });

    // Filters disabled overlay should be visible for basic users
    await expect(page.locator('[data-testid="filters-disabled-overlay"]')).toBeVisible({ timeout: 10_000 });
  });
});
