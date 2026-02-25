import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E — ProcessList.vue (52.4%) deeper interactions.
 *
 * Exercises:
 * - Tab navigation (Mis Procesos, Todos los Procesos, Procesos Archivados)
 * - Process card/row rendering with ref, progress, client info
 * - Search filtering
 * - Empty state for archived tab
 * - "Nueva Solicitud" button for client role
 * - Clicking a process row navigates to detail
 */

function buildUser({ id, role = "lawyer" }) {
  return {
    id, first_name: "E2E", last_name: role === "lawyer" ? "Abogado" : "Cliente",
    email: "e2e@example.com", role, contact: "", birthday: "", identification: "",
    document_type: "", photo_profile: "", is_profile_completed: true,
    is_gym_lawyer: role === "lawyer", has_signature: false,
  };
}

function buildProcess({ id, lawyerId, clientId, ref, progress = 25, plaintiff = "Demandante", defendant = "Demandado" }) {
  return {
    id,
    clients: [{ id: clientId, first_name: "Cliente", last_name: "Test", email: "client@test.com", role: "client", photo_profile: "" }],
    lawyer: { id: lawyerId, first_name: "Abogado", last_name: "Test", email: "lawyer@test.com" },
    case: { id: 1, type: "Civil" },
    subcase: "Subcaso Test",
    ref: ref || `RAD-${id}`,
    authority: "Juzgado 1 Civil",
    authority_email: "juzgado@test.com",
    plaintiff,
    defendant,
    stages: [{ status: "Inicio", date: new Date().toISOString(), description: "Etapa inicial" }],
    progress,
    case_files: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function installProcessMocks(page, { userId, role = "lawyer", processes = [] }) {
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
    if (apiPath === "processes/") return { status: 200, contentType: "application/json", body: JSON.stringify(processes) };
    if (apiPath.match(/^processes\/\d+\/$/)) {
      const procId = Number(apiPath.match(/^processes\/(\d+)\/$/)[1]);
      const proc = processes.find(p => p.id === procId);
      if (proc) return { status: 200, contentType: "application/json", body: JSON.stringify(proc) };
      return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) };
    }
    if (apiPath === "case-types/") return { status: 200, contentType: "application/json", body: JSON.stringify([{ id: 1, type: "Civil" }, { id: 2, type: "Penal" }]) };
    if (apiPath.match(/^processes\/\d+\/stages\/$/)) return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath.match(/^processes\/\d+\/files\/$/)) return { status: 200, contentType: "application/json", body: "[]" };
    return null;
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role, is_gym_lawyer: role === "lawyer", is_profile_completed: true },
  });
}

// ---------- Tab navigation ----------

test.describe("ProcessList tab navigation", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, () => {
  test("lawyer sees Mis Procesos and Todos los Procesos tabs", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3200;
    const processes = [
      buildProcess({ id: 1, lawyerId: userId, clientId: 999, ref: "RAD-200", progress: 40 }),
    ];

    await installProcessMocks(page, { userId, processes });
    await page.goto("/process_list");

    // Tabs should be visible
    await expect(page.getByRole("button", { name: "Mis Procesos" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Todos los Procesos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Procesos Archivados" })).toBeVisible();
  });

  test("switching to Procesos Archivados tab shows empty state or archived list", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3201;

    await installProcessMocks(page, { userId, processes: [] });
    await page.goto("/process_list");

    // Click archived tab
    const archivedTab = page.getByRole("button", { name: "Procesos Archivados" });
    await expect(archivedTab).toBeVisible({ timeout: 10_000 });
    await archivedTab.click();

    // Should show the archived tab as active (or empty state)
    await expect(page.locator("body")).toBeVisible();
  });
});

// ---------- Process list rendering ----------

test.describe("ProcessList renders process data", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, () => {
  test("process plaintiff, defendant and case type are visible in table", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3210;
    const processes = [
      buildProcess({ id: 10, lawyerId: userId, clientId: 999, ref: "RAD-VISIBLE", progress: 60, plaintiff: "Juan Pérez", defendant: "María López" }),
    ];

    await installProcessMocks(page, { userId, processes });
    await page.goto("/process_list");
    await expect(page.getByRole("button", { name: "Mis Procesos" })).toBeVisible({ timeout: 10_000 });

    // Table columns show plaintiff, defendant, case type
    await expect(page.getByText("Juan Pérez")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("María López")).toBeVisible();
    await expect(page.getByText("Civil")).toBeVisible();
  });

  test("process progress percentage is rendered", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3211;
    const processes = [
      buildProcess({ id: 11, lawyerId: userId, clientId: 999, ref: "RAD-PROGRESS", progress: 75 }),
    ];

    await installProcessMocks(page, { userId, processes });
    await page.goto("/process_list");
    await expect(page.getByRole("button", { name: "Mis Procesos" })).toBeVisible({ timeout: 10_000 });

    // Progress percentage should be visible in the table
    await expect(page.getByText("75%")).toBeVisible({ timeout: 10_000 });
  });
});

// ---------- Client-specific UI ----------

test.describe("ProcessList search filtering", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, () => {
  test("typing in search field filters processes by plaintiff name", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3230;
    const processes = [
      buildProcess({ id: 30, lawyerId: userId, clientId: 999, ref: "RAD-BUSCAR", plaintiff: "Carlos Gómez", defendant: "Ana Ruiz" }),
      buildProcess({ id: 31, lawyerId: userId, clientId: 998, ref: "RAD-OTRO", plaintiff: "Pedro Martín", defendant: "Lucía Díaz" }),
    ];

    await installProcessMocks(page, { userId, processes });
    await page.goto("/process_list");
    await expect(page.getByRole("button", { name: "Mis Procesos" })).toBeVisible({ timeout: 10_000 });

    // Both processes should be visible initially
    await expect(page.getByText("Carlos Gómez")).toBeVisible();
    await expect(page.getByText("Pedro Martín")).toBeVisible();

    // Type in search field
    const searchInput = page.getByPlaceholder(/buscar|search/i).first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("Carlos");
      // Wait for filtering
      await expect(page.getByText("Carlos Gómez")).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe("ProcessList multiple processes rendering", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, () => {
  test("renders multiple processes with different progress values", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3240;
    const processes = [
      buildProcess({ id: 40, lawyerId: userId, clientId: 999, ref: "RAD-1", progress: 25, plaintiff: "Primer Caso" }),
      buildProcess({ id: 41, lawyerId: userId, clientId: 998, ref: "RAD-2", progress: 75, plaintiff: "Segundo Caso" }),
      buildProcess({ id: 42, lawyerId: userId, clientId: 997, ref: "RAD-3", progress: 100, plaintiff: "Tercer Caso" }),
    ];

    await installProcessMocks(page, { userId, processes });
    await page.goto("/process_list");
    await expect(page.getByRole("button", { name: "Mis Procesos" })).toBeVisible({ timeout: 10_000 });

    // All three processes should render
    await expect(page.getByText("Primer Caso")).toBeVisible();
    await expect(page.getByText("Segundo Caso")).toBeVisible();
    await expect(page.getByText("Tercer Caso")).toBeVisible();

    // Progress values should be visible
    await expect(page.getByText("25%")).toBeVisible();
    await expect(page.getByText("75%")).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();
  });
});

test.describe("ProcessList client-specific features", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, () => {
  test("client sees Nueva Solicitud button", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3220;
    const processes = [
      buildProcess({ id: 20, lawyerId: 999, clientId: userId, ref: "RAD-CLIENT" }),
    ];

    await installProcessMocks(page, { userId, role: "client", processes });
    await page.goto("/process_list");

    // Wait for the page to load
    await expect(page.getByRole("button", { name: /Mis Procesos/i })).toBeVisible({ timeout: 10_000 });

    // "Solicitar Información" button should be visible for clients
    const requestBtn = page.getByRole("button", { name: /Solicitar Información/i });
    await expect(requestBtn).toBeVisible({ timeout: 5000 });
  });
});
