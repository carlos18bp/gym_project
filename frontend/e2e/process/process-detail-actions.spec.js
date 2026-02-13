import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessApiMocks,
  buildMockProcess,
  buildMockUser,
} from "../helpers/processMocks.js";

test("lawyer sees multiple case types and can navigate to detail", async ({ page }) => {
  const lawyerId = 7000;
  const clientId = 7001;

  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });
  const client = {
    id: clientId,
    first_name: "Ana",
    last_name: "García",
    email: "ana@example.com",
    role: "client",
    photo_profile: "",
  };

  const processes = [
    buildMockProcess({
      id: 5001,
      clients: [client],
      lawyer: { id: lawyerId },
      caseType: "Tutela",
      subcase: "Derecho Salud",
      ref: "RAD-5001",
      authority: "Juzgado 1",
      plaintiff: "Demandante A",
      defendant: "Demandado A",
      stages: [{ status: "Inicio" }, { status: "Trámite" }],
      progress: 40,
    }),
    buildMockProcess({
      id: 5002,
      clients: [client],
      lawyer: { id: lawyerId },
      caseType: "Laboral",
      subcase: "Despido",
      ref: "RAD-5002",
      authority: "Juzgado Laboral",
      plaintiff: "Empleado",
      defendant: "Empresa",
      stages: [{ status: "Inicio" }],
      progress: 10,
    }),
  ];

  await installProcessApiMocks(page, {
    userId: lawyerId,
    role: "lawyer",
    processes,
    users: [lawyer, client],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto(`/process_list/${lawyerId}`);

  // Should see both case types
  await expect(page.getByText("Tutela")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Laboral")).toBeVisible();
  await expect(page.getByText("40%")).toBeVisible();

  // Click into the Tutela process detail
  await page.getByRole("row", { name: /Ana García/ }).first().click();

  await expect(page).toHaveURL(/\/process_detail\/5001/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Tutela" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Derecho Salud")).toBeVisible();
});

test("lawyer can search processes by plaintiff name", async ({ page }) => {
  const lawyerId = 7010;

  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });
  const clientA = { id: 7011, first_name: "Carlos", last_name: "López", email: "carlos@example.com", role: "client", photo_profile: "" };
  const clientB = { id: 7012, first_name: "María", last_name: "Ruiz", email: "maria@example.com", role: "client", photo_profile: "" };

  const processes = [
    buildMockProcess({
      id: 5010,
      clients: [clientA],
      lawyer: { id: lawyerId },
      caseType: "Civil",
      ref: "RAD-5010",
      plaintiff: "Carlos López",
      defendant: "Empresa ABC",
      stages: [{ status: "Inicio" }],
      progress: 5,
    }),
    buildMockProcess({
      id: 5011,
      clients: [clientB],
      lawyer: { id: lawyerId },
      caseType: "Penal",
      ref: "RAD-5011",
      plaintiff: "María Ruiz",
      defendant: "Juan Pérez",
      stages: [{ status: "Inicio" }],
      progress: 15,
    }),
  ];

  await installProcessApiMocks(page, {
    userId: lawyerId,
    role: "lawyer",
    processes,
    users: [lawyer, clientA, clientB],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto(`/process_list/${lawyerId}`);

  const rowCarlos = page.getByRole("row", { name: /Carlos López/ });
  const rowMaria = page.getByRole("row", { name: /María Ruiz/ });
  await expect(rowCarlos).toBeVisible({ timeout: 15_000 });
  await expect(rowMaria).toBeVisible();

  // Search for Carlos
  await page.getByPlaceholder("Buscar procesos...").fill("Carlos");
  await expect(rowCarlos).toBeVisible();
  await expect(rowMaria).toBeHidden({ timeout: 5_000 });
});
