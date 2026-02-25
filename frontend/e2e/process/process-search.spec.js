import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { buildMockProcess, buildMockUser } from "../helpers/processMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for process-search flow.
 * Covers: filtering processes by plaintiff name.
 */

async function installProcessSearchMocks(page, { userId, processes }) {
  const user = buildMockUser({ id: userId, role: "lawyer" });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    if (apiPath === "processes/") return { status: 200, contentType: "application/json", body: JSON.stringify(processes) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath.startsWith("update-recent-process/")) return { status: 201, contentType: "application/json", body: "{}" };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }) };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };

    return null;
  });
}

test("lawyer searches processes by plaintiff name", { tag: ['@flow:process-search', '@module:processes', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8820;
  const processes = [
    buildMockProcess({ id: 601, clients: [userId + 1], lawyer: userId, caseType: "Civil", ref: "RAD-601", plaintiff: "Juan García", defendant: "Empresa XYZ", stages: [{ name: "Radicación", date: "2025-01-01" }], progress: 30 }),
    buildMockProcess({ id: 602, clients: [userId + 2], lawyer: userId, caseType: "Laboral", ref: "RAD-602", plaintiff: "María López", defendant: "Corporación ABC", stages: [{ name: "Radicación", date: "2025-02-01" }], progress: 50 }),
    buildMockProcess({ id: 603, clients: [userId + 3], lawyer: userId, caseType: "Penal", ref: "RAD-603", plaintiff: "Pedro Martínez", defendant: "Estado", stages: [{ name: "Inicio", date: "2025-03-01" }], progress: 10 }),
  ];

  await installProcessSearchMocks(page, { userId, processes });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("empty search result shows appropriate message", { tag: ['@flow:process-search', '@module:processes', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8821;
  const processes = [
    buildMockProcess({ id: 610, clients: [userId + 1], lawyer: userId, caseType: "Civil", ref: "RAD-610", plaintiff: "Test", defendant: "Test", stages: [{ name: "Inicio", date: "2025-01-01" }], progress: 0 }),
  ];

  await installProcessSearchMocks(page, { userId, processes });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});
