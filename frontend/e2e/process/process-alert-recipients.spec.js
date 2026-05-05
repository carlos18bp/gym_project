import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessApiMocks,
  buildMockProcess,
  buildMockUser,
} from "../helpers/processMocks.js";

/**
 * E2E for StageAlert recipient UI (Requirement #7, audit Issue #4):
 *  - ProcessDetail.vue indicator copy reflects notify_clients
 *  - ProcessHistoryModal.vue badge tooltip reflects notify_clients
 */

const TAGS = {
  tag: ['@flow:process-alert-configure', '@module:processes', '@priority:P2', '@role:lawyer'],
};

function buildProcessWithAlert({ notifyClients, isActive = true }) {
  const lawyerId = 9100;
  const clientId = 9101;
  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });
  const client = {
    id: clientId,
    first_name: "Ana",
    last_name: "Pérez",
    email: "ana@example.com",
    role: "client",
    photo_profile: "",
  };

  const stages = [
    { id: 901, status: "Apertura", date: "2026-05-01", alert: null },
    {
      id: 902,
      status: "Audiencia",
      date: "2026-06-15",
      alert: {
        id: 1,
        is_active: isActive,
        notify_clients: notifyClients,
        description: "",
      },
    },
  ];

  const process = buildMockProcess({
    id: 9001,
    clients: [client],
    lawyer: { id: lawyerId },
    caseType: "Civil",
    subcase: "Contractual",
    ref: "RAD-9001",
    authority: "Juzgado 1",
    plaintiff: "Demandante",
    defendant: "Demandado",
    stages,
    progress: 50,
  });

  return { process, lawyer, client, lawyerId };
}

test(
  "alert indicator shows lawyer-and-clients copy when notify_clients=true",
  TAGS,
  async ({ page }) => {
    const { process, lawyer, client, lawyerId } = buildProcessWithAlert({
      notifyClients: true,
    });

    await installProcessApiMocks(page, {
      userId: lawyerId,
      role: "lawyer",
      processes: [process],
      users: [lawyer, client],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: lawyerId,
        role: "lawyer",
        is_gym_lawyer: true,
        is_profile_completed: true,
      },
    });

    await page.goto(`/process_detail/${process.id}`);

    await expect(page.getByRole("heading", { name: "Civil" })).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      page.getByText(/Alerta activa.*Notifica al abogado y clientes/)
    ).toBeVisible({ timeout: 10_000 });
  }
);

test(
  "alert indicator shows lawyer-only copy when notify_clients=false",
  TAGS,
  async ({ page }) => {
    const { process, lawyer, client, lawyerId } = buildProcessWithAlert({
      notifyClients: false,
    });

    await installProcessApiMocks(page, {
      userId: lawyerId,
      role: "lawyer",
      processes: [process],
      users: [lawyer, client],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: lawyerId,
        role: "lawyer",
        is_gym_lawyer: true,
        is_profile_completed: true,
      },
    });

    await page.goto(`/process_detail/${process.id}`);

    await expect(page.getByRole("heading", { name: "Civil" })).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      page.getByText(/Alerta activa.*Notifica solo al abogado/)
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText(/Notifica al abogado y clientes/)
    ).toHaveCount(0);
  }
);

test(
  "history modal badge tooltip reflects notify_clients",
  TAGS,
  async ({ page }) => {
    const { process, lawyer, client, lawyerId } = buildProcessWithAlert({
      notifyClients: true,
    });

    await installProcessApiMocks(page, {
      userId: lawyerId,
      role: "lawyer",
      processes: [process],
      users: [lawyer, client],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: lawyerId,
        role: "lawyer",
        is_gym_lawyer: true,
        is_profile_completed: true,
      },
    });

    await page.goto(`/process_detail/${process.id}`);

    const historyBtn = page.getByRole("button", {
      name: /Histórico|Ver etapas/i,
    });
    await expect(historyBtn).toBeVisible({ timeout: 15_000 });
    await historyBtn.click();

    await expect(
      page.getByRole("heading", { name: "Histórico Procesal" })
    ).toBeVisible({ timeout: 10_000 });

    // quality: disable fragile_locator (span[title] is a semantic attribute selector; .first() guards against duplicate badge renders during async load)
    const alertBadge = page
      .locator('span[title="Notifica al abogado y clientes"]')
      .first();
    await expect(alertBadge).toBeVisible({ timeout: 5_000 });
    await expect(alertBadge).toContainText("Alerta");
  }
);
