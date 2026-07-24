import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { buildMockProcess, buildMockUser } from "../helpers/processMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for process-case-file-upload flow.
 * Covers: viewing the "Expediente" (case files) section of a process detail,
 * both with existing files and in its empty state.
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
  const lawyer = buildMockUser({ id: userId, role: "lawyer" });
  const processes = [
    buildMockProcess({
      id: 501, clients: [buildMockUser({ id: userId + 1, role: "client" })], lawyer,
      caseType: "Civil", ref: "RAD-501", plaintiff: "Demandante",
      defendant: "Demandado", stages: [{ status: "Radicación", date: "2025-01-01" }],
      progress: 25,
      // ProcessDetail derives the visible name from the `file` URL basename
      caseFiles: [
        { id: 1, file: "/media/case_files/demanda.pdf", created_at: "2025-01-01T10:00:00Z" },
      ],
    }),
  ];

  await installProcessWithFilesMocks(page, { userId, processes });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_list");
  await expect(page.getByText("Demandante", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Clicking the row navigates to the process detail
  await page.getByText("Demandante", { exact: true }).click();
  await expect(page).toHaveURL(/\/process_detail\/501/, { timeout: 10_000 });

  // The Expediente section lists the uploaded case file
  await expect(page.getByRole("heading", { name: "Expediente", exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("demanda.pdf")).toBeVisible();
});

test("lawyer sees process with empty case files", { tag: ['@flow:process-case-file-upload', '@module:processes', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8811;
  const lawyer = buildMockUser({ id: userId, role: "lawyer" });
  const processes = [
    buildMockProcess({
      id: 502, clients: [buildMockUser({ id: userId + 1, role: "client" })], lawyer,
      caseType: "Laboral", ref: "RAD-502", plaintiff: "Trabajador",
      defendant: "Empresa", stages: [{ status: "Inicio", date: "2025-02-01" }],
      progress: 10, caseFiles: [],
    }),
  ];

  await installProcessWithFilesMocks(page, { userId, processes });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_list");
  await expect(page.getByText("Trabajador", { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByText("Trabajador", { exact: true }).click();
  await expect(page).toHaveURL(/\/process_detail\/502/, { timeout: 10_000 });

  // The Expediente section shows its empty state when there are no files
  await expect(page.getByRole("heading", { name: "Expediente", exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("No hay expedientes registrados")).toBeVisible();
});
