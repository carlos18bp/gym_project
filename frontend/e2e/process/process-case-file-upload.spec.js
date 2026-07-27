import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockProcess,
  buildMockUser,
  installProcessApiMocks,
} from "../helpers/processMocks.js";
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

test("lawyer navigates to process detail and sees case files section", { tag: ['@flow:process-case-file-upload', '@module:processes', '@priority:P2', '@role:lawyer', '@outcome:display'] }, async ({ page }) => {
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

test("lawyer uploads a new case file while editing: it reaches update_case_file/ and shows up back on the process detail's Expediente list", { tag: ['@flow:process-case-file-upload', '@module:processes', '@priority:P2', '@role:lawyer', '@outcome:success'] }, async ({ page }) => {
  test.setTimeout(60_000);
  const userId = 8812;
  const lawyer = buildMockUser({ id: userId, role: "lawyer" });
  const client = buildMockUser({ id: userId + 1, role: "client" });

  const existingProcess = buildMockProcess({
    id: 503,
    clients: [client],
    lawyer,
    caseType: "Civil",
    // Saving needs the nested case id the real ProcessSerializer sends:
    // ProcessForm submits selectedCaseType.id as caseTypeId, and
    // validateFormData() blocks the whole submit when it is empty.
    caseTypeId: 1,
    subcase: "Contractual",
    ref: "RAD-503",
    authority: "Juzgado 1",
    plaintiff: "Nueva Demandante",
    defendant: "Nuevo Demandado",
    stages: [{ status: "Radicación", date: "2025-01-01" }],
    progress: 15,
    caseFiles: [],
  });

  await installProcessApiMocks(page, {
    userId,
    role: "lawyer",
    processes: [existingProcess],
    users: [lawyer, client],
  });

  // installProcessApiMocks doesn't mock either endpoint, so these narrow
  // routes (registered after it) both win and let the save succeed.
  await page.route(`**/update_process/${existingProcess.id}/`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  const uploadedFileNames = [];
  await page.route("**/update_case_file/", async (route) => {
    const body = route.request().postData() || "";
    const match = body.match(/name="file";\s*filename="([^"]+)"/);
    const fileName = match ? match[1] : "unknown";
    uploadedFileNames.push(fileName);
    // Mutates the same object referenced by installProcessApiMocks' closure,
    // so the next processes/ GET (fetchProcessesData, right before the app
    // navigates back to the detail view) serves the file that was "saved".
    existingProcess.case_files.push({
      id: 9101,
      file: `/media/case_files/${fileName}`,
      created_at: "2026-07-01T10:00:00Z",
    });
    await route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_list");
  await expect(page.getByText("Nueva Demandante", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Real navigation: list -> detail -> edit.
  await page.getByText("Nueva Demandante", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/process_detail/${existingProcess.id}`), { timeout: 10_000 });

  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { name: "Información del proceso" })).toBeVisible({ timeout: 15_000 });

  // The Documento table starts empty for this process — add a row (its own
  // "Nuevo" button, scoped away from the stages table's identical label)
  // and upload into it.
  const caseFilesTable = page.locator("table", { hasText: "Documento" });
  await caseFilesTable.getByRole("button", { name: "Nuevo" }).click();

  await page.locator("#file-0").setInputFiles({
    name: "expediente-nuevo-e2e.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%PDF-MOCK\n", "utf-8"),
  });

  await page.getByRole("button", { name: "Guardar Proceso" }).click();

  const successDialog = page.getByRole("dialog");
  await expect(successDialog).toBeVisible({ timeout: 15_000 });
  await expect(successDialog).toContainText("Exitoso");
  await page.getByRole("button", { name: /^(OK!?|Aceptar)$/i }).click();

  // Saving an edit navigates back to the detail (router.back()) once the
  // update and the file upload both resolve.
  await expect(page).toHaveURL(new RegExp(`/process_detail/${existingProcess.id}`), { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Expediente", exact: true })).toBeVisible({ timeout: 10_000 });

  // The upload actually happened (real setInputFiles reached the backend
  // call), and the file the user just added — not a stale/empty list — is
  // what the detail view the user lands on actually shows.
  expect(uploadedFileNames).toEqual(["expediente-nuevo-e2e.pdf"]);
  await expect(page.getByText("expediente-nuevo-e2e.pdf")).toBeVisible({ timeout: 10_000 });
});
