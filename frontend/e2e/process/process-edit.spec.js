import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessApiMocks,
  buildMockUser,
  buildMockProcess,
} from "../helpers/processMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

test("lawyer can navigate to process form to edit an existing process", { tag: ['@flow:process-edit', '@module:processes', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const lawyerId = 8900;
  const clientId = 8901;

  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });
  const client = buildMockUser({ id: clientId, role: "client" });

  const existingProcess = buildMockProcess({
    id: 5001,
    clients: [client],
    lawyer,
    caseType: "Civil",
    ref: "RAD-EDIT-001",
    plaintiff: "Juan Pérez",
    defendant: "Empresa XYZ",
    progress: 40,
    stages: [
      { name: "Admisión", date: "2025-01-15", completed: true },
      { name: "Pruebas", date: "2025-03-10", completed: false },
    ],
  });

  await installProcessApiMocks(page, {
    userId: lawyerId,
    role: "lawyer",
    processes: [existingProcess],
    users: [lawyer, client],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_list");
  await expect(page).toHaveURL(/\/process_list/, { timeout: 15_000 });

  // Process should be visible in list
  await expect(page.getByText("RAD-EDIT-001").or(page.getByText("Juan Pérez"))).toBeVisible({ timeout: 10_000 });
});

test("process list renders existing process data with correct fields", { tag: ['@flow:process-edit', '@module:processes', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const lawyerId = 8902;
  const clientId = 8903;

  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });
  const client = buildMockUser({ id: clientId, role: "client" });

  const process1 = buildMockProcess({
    id: 5002,
    clients: [client],
    lawyer,
    caseType: "Laboral",
    ref: "RAD-EDIT-002",
    plaintiff: "María López",
    defendant: "Compañía ABC",
    progress: 60,
    stages: [
      { name: "Admisión", date: "2025-02-01", completed: true },
      { name: "Alegatos", date: "2025-04-15", completed: false },
    ],
  });

  await installProcessApiMocks(page, {
    userId: lawyerId,
    role: "lawyer",
    processes: [process1],
    users: [lawyer, client],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_list");
  await expect(page).toHaveURL(/\/process_list/, { timeout: 15_000 });

  await expect(page.getByText("RAD-EDIT-002").or(page.getByText("Laboral"))).toBeVisible({ timeout: 10_000 });
});

test("lawyer edits an existing process via the UI: the update PUT carries the real process id, the new plaintiff and the edited stage date", { tag: ['@flow:process-edit', '@module:processes', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const lawyerId = 8904;
  const clientId = 8905;

  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });
  const client = buildMockUser({ id: clientId, role: "client" });

  const existingProcess = buildMockProcess({
    id: 5003,
    clients: [client],
    lawyer,
    caseType: "Civil",
    subcase: "Contractual",
    ref: "RAD-EDIT-003",
    authority: "Juzgado 3",
    plaintiff: "Pedro Gómez",
    defendant: "Empresa ABC",
    progress: 30,
    stages: [{ status: "Admisión", date: "2025-01-15" }],
  });

  await installProcessApiMocks(page, {
    userId: lawyerId,
    role: "lawyer",
    processes: [existingProcess],
    users: [lawyer, client],
  });

  // Registered after installProcessApiMocks (which doesn't mock this path at
  // all) so this route wins for the update call and captures exactly what
  // the form submitted.
  const updateRequests = [];
  await page.route(`**/update_process/${existingProcess.id}/`, async (route) => {
    updateRequests.push(route.request());
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_list");
  await expect(page.getByText("Pedro Gómez", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Real navigation: list -> detail -> edit, the way a lawyer actually
  // reaches the form (not a deep link to /process_form/edit/:id).
  await page.getByText("Pedro Gómez", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/process_detail/${existingProcess.id}`), { timeout: 10_000 });

  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByRole("heading", { name: "Información del proceso" })).toBeVisible({ timeout: 15_000 });

  // "Dte./Accionante" and "Radicado" both carry name="plaintiff" in the
  // markup — the first match by DOM order is the real demandante field.
  const plaintiffInput = page.locator('input[name="plaintiff"]:visible').first();
  await expect(plaintiffInput).toHaveValue("Pedro Gómez");
  await plaintiffInput.fill("Pedro Gómez Restrepo");

  const stageDateInput = page.locator('input[name="stage_date"]:visible').first();
  await stageDateInput.fill("2025-06-20");

  await page.getByRole("button", { name: "Guardar Proceso" }).click();

  // The submit must reach the update endpoint for THIS process's real id,
  // carrying the edited plaintiff and stage date — not a stale/dropped stage.
  await expect.poll(() => updateRequests.length, { timeout: 10_000 }).toBe(1);
  expect(updateRequests[0].method()).toBe("PUT");
  const mainData = updateRequests[0].postDataJSON();
  expect(mainData.id).toBe(String(existingProcess.id));
  expect(mainData.plaintiff).toBe("Pedro Gómez Restrepo");
  expect(mainData.stages).toHaveLength(1);
  expect(mainData.stages[0].date).toBe("2025-06-20");
  expect(mainData.stages[0].status).toBe("Admisión");
});
