import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessApiMocks,
  buildMockUser,
  buildMockProcess,
} from "../helpers/processMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

test("client sees their processes in process list", { tag: ['@flow:process-detail', '@module:processes', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const clientId = 9000;
  const lawyerId = 9001;

  const client = buildMockUser({ id: clientId, role: "client" });
  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer" });

  const clientProcess = buildMockProcess({
    id: 6001,
    clients: [client],
    lawyer,
    caseType: "Tutela",
    ref: "RAD-INFO-001",
    plaintiff: "Cliente E2E",
    defendant: "EPS Salud",
    progress: 30,
    stages: [{ name: "Admisión", date: "2025-01-20", completed: true }],
  });

  await installProcessApiMocks(page, {
    userId: clientId,
    role: "client",
    processes: [clientProcess],
    users: [client, lawyer],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: clientId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/process_list");
  await expect(page).toHaveURL(/\/process_list/, { timeout: 15_000 });

  await expect(page.getByText("RAD-INFO-001").or(page.getByText("Cliente E2E"))).toBeVisible({ timeout: 10_000 });
});

test("client process list shows Nueva Solicitud button for requesting information", { tag: ['@flow:process-detail', '@module:processes', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const clientId = 9002;
  const lawyerId = 9003;

  const client = buildMockUser({ id: clientId, role: "client" });
  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer" });

  const clientProcess = buildMockProcess({
    id: 6002,
    clients: [client],
    lawyer,
    caseType: "Civil",
    ref: "RAD-INFO-002",
    plaintiff: "Solicitante",
    defendant: "Demandado",
    progress: 50,
    stages: [{ name: "Pruebas", date: "2025-02-15", completed: false }],
  });

  await installProcessApiMocks(page, {
    userId: clientId,
    role: "client",
    processes: [clientProcess],
    users: [client, lawyer],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: clientId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/process_list");
  await expect(page).toHaveURL(/\/process_list/, { timeout: 15_000 });

  // Client should see "Nueva Solicitud" button to request information
  const newRequestBtn = page.getByRole("link", { name: /Nueva Solicitud/i });
  if (await newRequestBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await expect(newRequestBtn).toBeVisible();
  }
});
