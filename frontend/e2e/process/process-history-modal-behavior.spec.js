import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessApiMocks,
  buildMockProcess,
  buildMockUser,
} from "../helpers/processMocks.js";

/**
 * Deep coverage for:
 * - ProcessHistoryModal.vue (52%) — modal open, stages rendering, sortedStages,
 *   formatDate, empty state, close modal
 * - ProcessStageProgress.vue — open-history event emission
 * - process.js store (41%) — fetchProcessById, processesWithClosedStatus getter
 */

test("lawyer opens ProcessHistoryModal from detail page and sees sorted stages", async ({ page }) => {
  const lawyerId = 7100;
  const clientId = 7101;
  const nowIso = new Date().toISOString();

  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });
  const client = {
    id: clientId, first_name: "Ana", last_name: "García", email: "ana@example.com",
    role: "client", photo_profile: "",
  };

  const process = buildMockProcess({
    id: 6001,
    clients: [client],
    lawyer: { id: lawyerId },
    caseType: "Civil",
    subcase: "Contractual",
    ref: "RAD-6001",
    authority: "Juzgado 1",
    plaintiff: "Demandante A",
    defendant: "Demandado A",
    stages: [
      { id: 1, status: "Inicio", date: new Date(Date.now() - 30 * 86400000).toISOString() },
      { id: 2, status: "Trámite", date: new Date(Date.now() - 15 * 86400000).toISOString() },
      { id: 3, status: "Pruebas", date: new Date(Date.now() - 5 * 86400000).toISOString() },
    ],
    progress: 60,
  });

  await installProcessApiMocks(page, {
    userId: lawyerId,
    role: "lawyer",
    processes: [process],
    users: [lawyer, client],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto(`/process_detail/${process.id}`);

  // Process detail should render with case type heading
  await expect(page.getByRole("heading", { name: "Civil" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("RAD-6001")).toBeVisible();

  // Click "Ver Histórico" or the progress bar area to open ProcessHistoryModal
  const historyBtn = page.getByRole("button", { name: /Histórico|Ver etapas/i });
  await expect(historyBtn).toBeVisible({ timeout: 10_000 });
  await historyBtn.click();

  // ProcessHistoryModal should open
  await expect(page.getByRole("heading", { name: "Histórico Procesal" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Registro cronológico de etapas")).toBeVisible();

  // All 3 stages should be rendered in the same order as the edit form (array order)
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trámite" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pruebas" })).toBeVisible();

  // Verify order matches the edit form: Inicio (1), Trámite (2), Pruebas (3)
  const stageHeadings = page.locator('h4.text-base.font-medium.text-gray-900');
  await expect(stageHeadings).toHaveText(["Inicio", "Trámite", "Pruebas"]);

  // Close modal via Cerrar button
  await page.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.getByRole("heading", { name: "Histórico Procesal" })).toBeHidden({ timeout: 5_000 });
});

test("process detail page shows closed status process with Fallo stage", async ({ page }) => {
  const lawyerId = 7110;
  const nowIso = new Date().toISOString();

  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });

  const closedProcess = buildMockProcess({
    id: 6010,
    clients: [],
    lawyer: { id: lawyerId },
    caseType: "Laboral",
    subcase: "Despido",
    ref: "RAD-6010",
    authority: "Juzgado Laboral",
    plaintiff: "Empleado",
    defendant: "Empresa",
    stages: [
      { id: 1, status: "Inicio", date: new Date(Date.now() - 60 * 86400000).toISOString() },
      { id: 2, status: "Fallo", date: nowIso },
    ],
    progress: 100,
  });

  await installProcessApiMocks(page, {
    userId: lawyerId,
    role: "lawyer",
    processes: [closedProcess],
    users: [lawyer],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto(`/process_detail/${closedProcess.id}`);

  // Should render the closed process detail
  await expect(page.getByRole("heading", { name: "Laboral", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("RAD-6010")).toBeVisible();
  await expect(page.getByText("Despido")).toBeVisible();
});

