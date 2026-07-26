import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
import { bypassCaptcha } from "../helpers/captcha.js";
import { installAuthSignInApiMocks } from "../helpers/authSignInMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

function buildMockUser({ id, role = "lawyer" }) {
  return {
    id,
    first_name: "E2E",
    last_name: "Idle",
    email: `idle-${id}@example.com`,
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
}

async function installIdleLogoutMocks(page, { userId, role = "lawyer" }) {
  const user = buildMockUser({ id: userId, role });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
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
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }),
      };
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

    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    return null;
  });
}

test("idle timeout logs the user out and redirects to sign_in without any activity", { tag: ['@flow:auth-idle-logout', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(60_000);
  const userId = 8103;
  const email = `lawyer.${userId}@test.local`;

  await installAuthSignInApiMocks(page, { userId, role: "lawyer", signInStatus: 200 });

  // Install the fake clock before the SPA boots: useIdleLogout's
  // setTimeout(handleIdle, timeout) is only scheduled by App.vue's real
  // router/authStore wiring (watch(authStore.token) -> subscribe()) once
  // login succeeds, well after this call — so the clock must already be
  // active by then to capture it instead of a real 15-minute native timer.
  await page.clock.install();

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({
    timeout: 15_000,
  });

  await page.locator('[id="email"]').fill(email);
  await page.locator('[id="password"]').fill("password");
  await bypassCaptcha(page);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 10_000 })
    .toBe("e2e-access-token");

  // No further interaction from here on: jump the clock past the
  // composable's 15-minute idle threshold. If useIdleLogout never receives
  // the real router/authStore in production wiring (only in its own unit
  // test's mocks), this timer never fires and the assertions below time out.
  await page.clock.fastForward(16 * 60 * 1000);

  await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });
  const token = await page.evaluate(() => localStorage.getItem("token"));
  expect(token).toBeNull();
});

test("unauthenticated user accessing dashboard is redirected to sign_in", { tag: ['@flow:auth-idle-logout', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 8101;

  // Mock validate_token to return 401 (simulating post-idle state)
  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "expired" }) };
    }

    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    return null;
  });

  // Set an expired/invalid token — simulates state after idle logout clears auth
  await setAuthLocalStorage(page, {
    token: "expired-token",
    userAuth: { id: userId, role: "lawyer" },
  });

  await page.goto("/dashboard");

  // Should be redirected to sign_in because token validation fails
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });

  // Sign-in page should render correctly
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible();
});
