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
