import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { buildMockProcess, buildMockUser } from "../helpers/processMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for process-search flow.
 * Covers: filtering processes by plaintiff name in the process list.
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

// The "Mis Procesos" tab filters on process.lawyer.id, so the lawyer must be
// embedded as an object (not a scalar id) for rows to render.
function buildLawyerProcesses(userId) {
  const lawyer = buildMockUser({ id: userId, role: "lawyer" });
  const clientFor = (id) => buildMockUser({ id, role: "client" });

  return [
    buildMockProcess({ id: 601, clients: [clientFor(userId + 1)], lawyer, caseType: "Civil", ref: "RAD-601", plaintiff: "Juan García", defendant: "Empresa XYZ", stages: [{ status: "Radicación", date: "2025-01-01" }], progress: 30 }),
    buildMockProcess({ id: 602, clients: [clientFor(userId + 2)], lawyer, caseType: "Laboral", ref: "RAD-602", plaintiff: "María López", defendant: "Corporación ABC", stages: [{ status: "Radicación", date: "2025-02-01" }], progress: 50 }),
    buildMockProcess({ id: 603, clients: [clientFor(userId + 3)], lawyer, caseType: "Penal", ref: "RAD-603", plaintiff: "Pedro Martínez", defendant: "Estado", stages: [{ status: "Inicio", date: "2025-03-01" }], progress: 10 }),
  ];
}

test("lawyer searches processes by plaintiff name", { tag: ['@flow:process-search', '@module:processes', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8820;
  const processes = buildLawyerProcesses(userId);

  await installProcessSearchMocks(page, { userId, processes });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_list");
  await expect(page.getByRole("button", { name: "Mis Procesos" })).toBeVisible({ timeout: 15_000 });

  // All three processes render before searching
  await expect(page.getByText("Juan García")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("María López")).toBeVisible();
  await expect(page.getByText("Pedro Martínez")).toBeVisible();

  // Search by plaintiff name filters the table down to the single match
  await page.getByPlaceholder("Buscar procesos...").fill("Juan García");
  await expect(page.getByText("Juan García")).toBeVisible();
  await expect(page.getByText("María López")).toHaveCount(0);
  await expect(page.getByText("Pedro Martínez")).toHaveCount(0);
});

test("empty search result shows appropriate message", { tag: ['@flow:process-search', '@module:processes', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8821;
  const lawyer = buildMockUser({ id: userId, role: "lawyer" });
  const processes = [
    buildMockProcess({ id: 610, clients: [buildMockUser({ id: userId + 1, role: "client" })], lawyer, caseType: "Civil", ref: "RAD-610", plaintiff: "Único Demandante", defendant: "Único Demandado", stages: [{ status: "Inicio", date: "2025-01-01" }], progress: 0 }),
  ];

  await installProcessSearchMocks(page, { userId, processes });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_list");
  await expect(page.getByRole("button", { name: "Mis Procesos" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Único Demandante")).toBeVisible({ timeout: 10_000 });

  // A query with no matches hides all rows and surfaces the empty state
  await page.getByPlaceholder("Buscar procesos...").fill("proceso-inexistente-zzz");
  await expect(page.getByText("No hay procesos disponibles")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Único Demandante")).toHaveCount(0);
});
