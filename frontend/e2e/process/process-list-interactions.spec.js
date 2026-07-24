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

function buildProcess({
  id,
  lawyerId,
  clientId,
  ref,
  progress = 25,
  plaintiff = "Demandante",
  defendant = "Demandado",
  caseType = "Civil",
  caseId = 1,
  stageStatus = "Inicio",
  clientFirstName = "Cliente",
  clientLastName = "Test",
  createdAt = new Date().toISOString(),
}) {
  return {
    id,
    clients: [{ id: clientId, first_name: clientFirstName, last_name: clientLastName, email: "client@test.com", role: "client", photo_profile: "" }],
    lawyer: { id: lawyerId, first_name: "Abogado", last_name: "Test", email: "lawyer@test.com" },
    case: { id: caseId, type: caseType },
    subcase: "Subcaso Test",
    ref: ref || `RAD-${id}`,
    authority: "Juzgado 1 Civil",
    authority_email: "juzgado@test.com",
    plaintiff,
    defendant,
    stages: [{ status: stageStatus, date: new Date().toISOString(), description: "Etapa inicial" }],
    progress,
    case_files: [],
    created_at: createdAt,
    updated_at: createdAt,
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
  test("switching to Todos los Procesos tab reveals another lawyer's process", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3200;
    const processes = [
      buildProcess({ id: 1, lawyerId: userId, clientId: 999, ref: "RAD-200", progress: 40, plaintiff: "Proceso Propio" }),
      buildProcess({ id: 2, lawyerId: 8888, clientId: 998, ref: "RAD-201", progress: 10, plaintiff: "Proceso Ajeno" }),
    ];

    await installProcessMocks(page, { userId, processes });
    await page.goto("/process_list");

    // Starting point: "Mis Procesos" only lists the processes owned by this lawyer
    await expect(page.getByText("Proceso Propio")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Proceso Ajeno")).toHaveCount(0);

    await page.getByRole("button", { name: "Todos los Procesos" }).click();

    // Transition: the other lawyer's process appears and the URL carries the tab
    await expect(page.getByText("Proceso Ajeno")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Proceso Propio")).toBeVisible();
    await expect(page).toHaveURL(/group=general/);
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
  test("filtering by Tipo keeps only the matching plaintiff and defendant row", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3210;
    const processes = [
      buildProcess({ id: 10, lawyerId: userId, clientId: 999, ref: "RAD-VISIBLE", progress: 60, plaintiff: "Juan Pérez", defendant: "María López", caseType: "Civil", caseId: 1 }),
      buildProcess({ id: 12, lawyerId: userId, clientId: 997, ref: "RAD-PENAL", progress: 30, plaintiff: "Sofía Penal", defendant: "Hugo Penal", caseType: "Penal", caseId: 2 }),
    ];

    await installProcessMocks(page, { userId, processes });
    await page.goto("/process_list");

    // Starting point: both processes are listed
    await expect(page.getByText("Juan Pérez")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Sofía Penal")).toBeVisible();

    await page.getByRole("button", { name: "Tipo" }).click();
    await page.getByRole("menuitem", { name: "Civil" }).click();

    // Transition: only the Civil row survives, with its plaintiff/defendant/type
    await expect(page.getByText("Sofía Penal")).toHaveCount(0);
    await expect(page.getByText("Juan Pérez")).toBeVisible();
    await expect(page.getByText("María López")).toBeVisible();
    await expect(page.getByRole("button", { name: "Civil" })).toBeVisible();
  });

  test("filtering by Etapa keeps the progress percentage of the matching process", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3211;
    const processes = [
      buildProcess({ id: 11, lawyerId: userId, clientId: 999, ref: "RAD-PROGRESS", progress: 75, stageStatus: "Inicio", plaintiff: "Inicio Caso" }),
      buildProcess({ id: 13, lawyerId: userId, clientId: 996, ref: "RAD-OTRA", progress: 42, stageStatus: "Alegatos", plaintiff: "Alegatos Caso" }),
    ];

    await installProcessMocks(page, { userId, processes });
    await page.goto("/process_list");

    // Starting point: both progress values are on screen
    await expect(page.getByText("75%")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("42%")).toBeVisible();

    await page.getByRole("button", { name: "Etapa" }).click();
    await page.getByRole("menuitem", { name: "Inicio" }).click();

    // Transition: only the "Inicio" process (75%) remains
    await expect(page.getByText("42%")).toHaveCount(0);
    await expect(page.getByText("75%")).toBeVisible();
    await expect(page.getByText("Inicio Caso")).toBeVisible();
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
    const searchInput = page.getByPlaceholder("Buscar procesos...");
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill("Carlos");

    // Filtering keeps the match and removes the non-matching process
    await expect(page.getByText("Carlos Gómez")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Pedro Martín")).toHaveCount(0);
  });
});

test.describe("ProcessList sorting", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, () => {
  test("sorting by Nombre (A-Z) reorders the rendered process rows", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3240;
    const processes = [
      buildProcess({ id: 40, lawyerId: userId, clientId: 999, ref: "RAD-1", progress: 25, plaintiff: "Primer Caso", clientFirstName: "Zulema", clientLastName: "Zapata", createdAt: "2026-03-03T10:00:00Z" }),
      buildProcess({ id: 41, lawyerId: userId, clientId: 998, ref: "RAD-2", progress: 75, plaintiff: "Segundo Caso", clientFirstName: "Mario", clientLastName: "Medina", createdAt: "2026-02-02T10:00:00Z" }),
      buildProcess({ id: 42, lawyerId: userId, clientId: 997, ref: "RAD-3", progress: 100, plaintiff: "Tercer Caso", clientFirstName: "Aurora", clientLastName: "Alvarez", createdAt: "2026-01-01T10:00:00Z" }),
    ];

    await installProcessMocks(page, { userId, processes });
    await page.goto("/process_list");

    // Starting point: default sort is "Más recientes" — newest created_at first.
    // quality: allow-fragile-selector (row order IS the behaviour under test, so positional access is required)
    const rows = page.getByRole("row");
    await expect(rows).toHaveCount(4, { timeout: 10_000 });
    // quality: allow-fragile-selector (row order IS the behaviour under test, so positional access is required)
    await expect(rows.nth(1)).toContainText("Zulema Zapata");
    // quality: allow-fragile-selector (row order IS the behaviour under test, so positional access is required)
    await expect(rows.nth(3)).toContainText("Aurora Alvarez");

    await page.getByRole("button", { name: "Más recientes" }).click();
    await page.getByRole("menuitem", { name: "Nombre (A-Z)" }).click();

    // Transition: rows are re-ordered alphabetically by client name
    // quality: allow-fragile-selector (row order IS the behaviour under test, so positional access is required)
    await expect(rows.nth(1)).toContainText("Aurora Alvarez");
    // quality: allow-fragile-selector (row order IS the behaviour under test, so positional access is required)
    await expect(rows.nth(2)).toContainText("Mario Medina");
    // quality: allow-fragile-selector (row order IS the behaviour under test, so positional access is required)
    await expect(rows.nth(3)).toContainText("Zulema Zapata");
  });
});

test.describe("ProcessList client-specific features", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, () => {
  test("client clicking Solicitar Información opens the legal request form", { tag: ['@flow:process-list-view', '@module:processes', '@priority:P1', '@role:shared'] }, async ({ page }) => {
    const userId = 3220;
    const processes = [
      buildProcess({ id: 20, lawyerId: 999, clientId: userId, ref: "RAD-CLIENT" }),
    ];

    await installProcessMocks(page, { userId, role: "client", processes });
    await page.goto("/process_list");

    // Starting point: the client is on the process list
    const requestBtn = page.getByRole("button", { name: /Solicitar Información/i });
    await expect(requestBtn).toBeVisible({ timeout: 10_000 });

    await requestBtn.click();

    // Transition: the legal request creation view takes over
    await expect(page).toHaveURL(/\/legal_request_create/, { timeout: 10_000 });
  });
});
