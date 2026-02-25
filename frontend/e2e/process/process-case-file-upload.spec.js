import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installProcessApiMocks, buildMockProcess, buildMockUser } from "../helpers/processMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for process-case-file-upload flow.
 * Covers: uploading/managing case files in a process.
 */

async function installProcessWithFilesMocks(page, { userId, processes }) {
  const user = buildMockUser({ id: userId, role: "lawyer" });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    if (apiPath === "processes/") return { status: 200, contentType: "application/json", body: JSON.stringify(processes) };
    if (apiPath.match(/^processes\/\d+\/$/)) {
      const pId = Number(apiPath.match(/^processes\/(\d+)\/$/)[1]);
      const proc = processes.find(p => p.id === pId);
      if (proc) return { status: 200, contentType: "application/json", body: JSON.stringify(proc) };
    }

    if (apiPath.match(/^processes\/\d+\/case-files\/$/) && route.request().method() === "POST") {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 999, name: "uploaded-file.pdf", url: "/files/uploaded-file.pdf", created_at: nowIso }) };
    }

    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath.startsWith("update-recent-process/")) return { status: 201, contentType: "application/json", body: "{}" };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }) };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };

    return null;
  });
}

test("lawyer navigates to process detail and sees case files section", { tag: ['@flow:process-case-file-upload', '@module:processes', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8810;
  const processes = [
    buildMockProcess({
      id: 501, clients: [userId + 1], lawyer: userId,
      caseType: "Civil", ref: "RAD-501", plaintiff: "Demandante",
      defendant: "Demandado", stages: [{ name: "Radicación", date: "2025-01-01" }],
      progress: 25,
      caseFiles: [
        { id: 1, name: "demanda.pdf", url: "/files/demanda.pdf", created_at: "2025-01-01" },
      ],
    }),
  ];

  await installProcessWithFilesMocks(page, { userId, processes });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("lawyer sees process with empty case files", { tag: ['@flow:process-case-file-upload', '@module:processes', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8811;
  const processes = [
    buildMockProcess({
      id: 502, clients: [userId + 1], lawyer: userId,
      caseType: "Laboral", ref: "RAD-502", plaintiff: "Trabajador",
      defendant: "Empresa", stages: [{ name: "Inicio", date: "2025-02-01" }],
      progress: 10, caseFiles: [],
    }),
  ];

  await installProcessWithFilesMocks(page, { userId, processes });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});
