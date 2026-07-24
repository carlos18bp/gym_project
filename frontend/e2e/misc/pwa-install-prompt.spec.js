import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for PWAInstallInstructionsModal.vue (58.8%)
 * and usePWAInstall.js composable (55.1%).
 * PWA install features are tested by navigating to the dashboard
 * which loads the PWA composable and checks for install prompts.
 */

function buildUser({ id, role = "lawyer" }) {
  return {
    id, first_name: "E2E", last_name: "User", email: "e2e@example.com",
    role, contact: "", birthday: "", identification: "", document_type: "",
    photo_profile: "", is_profile_completed: true, is_gym_lawyer: role === "lawyer",
    has_signature: false,
  };
}

async function installDashMocks(page, { userId, role = "lawyer" }) {
  const user = buildUser({ id: userId, role });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-key" }) };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "processes/") return { status: 200, contentType: "application/json", body: "[]" };
    return null;
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role, is_gym_lawyer: role === "lawyer", is_profile_completed: true },
  });
}

test.describe("PWA Install - manual instructions fallback", { tag: ['@flow:misc-pwa-install', '@module:misc', '@priority:P4', '@role:shared'] }, () => {
  test("lawyer opens the manual install instructions from the sidebar", { tag: ['@flow:misc-pwa-install', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await installDashMocks(page, { userId: 3300 });
    await page.goto("/dashboard");

    const installEntry = page.getByTestId("pwa-install-button");
    await expect(installEntry).toBeVisible({ timeout: 15_000 });

    // No beforeinstallprompt fired in this browser session, so promptInstall()
    // must fall back to the manual instructions modal.
    await installEntry.click();

    const instructionsTitle = page.getByRole("heading", { name: "Instalar Aplicación" });
    await expect(instructionsTitle).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Para instalar la aplicación en tu dispositivo, sigue estos pasos:")).toBeVisible();
  });

  test("client closes the install instructions modal", { tag: ['@flow:misc-pwa-install', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await installDashMocks(page, { userId: 3301, role: "client" });
    await page.goto("/dashboard");

    const installEntry = page.getByTestId("pwa-install-button");
    await expect(installEntry).toBeVisible({ timeout: 15_000 });
    await installEntry.click();

    const instructionsTitle = page.getByRole("heading", { name: "Instalar Aplicación" });
    await expect(instructionsTitle).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Cerrar" }).click();

    await expect(instructionsTitle).toBeHidden({ timeout: 10_000 });
  });
});

test.describe("PWA Install - native browser prompt", { tag: ['@flow:misc-pwa-install', '@module:misc', '@priority:P4', '@role:shared'] }, () => {
  test("install button triggers the native prompt when the browser deferred one", { tag: ['@flow:misc-pwa-install', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await installDashMocks(page, { userId: 3310 });
    await page.goto("/dashboard");

    const installEntry = page.getByTestId("pwa-install-button");
    await expect(installEntry).toBeVisible({ timeout: 15_000 });

    // Replay the browser event the composable listens for at module load.
    await page.evaluate(() => {
      window.__e2eNativePromptCalled = false;
      const deferred = new Event("beforeinstallprompt");
      deferred.prompt = () => {
        window.__e2eNativePromptCalled = true;
      };
      deferred.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(deferred);
    });

    await installEntry.click();

    await expect
      .poll(() => page.evaluate(() => window.__e2eNativePromptCalled), { timeout: 10_000 })
      .toBe(true);
    await expect(page.getByRole("heading", { name: "Instalar Aplicación" })).toBeHidden();
  });
});
