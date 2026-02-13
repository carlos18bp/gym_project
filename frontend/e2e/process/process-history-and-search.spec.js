import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessApiMocks,
  buildMockProcess,
  buildMockUser,
} from "../helpers/processMocks.js";

test("lawyer can switch between active and history processes", async ({ page }) => {
  const lawyerId = 6000;
  const clientId = 6001;

  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });
  const client = {
    id: clientId,
    first_name: "Client",
    last_name: "History",
    email: "client@example.com",
    role: "client",
    photo_profile: "",
  };

  const processes = [
    buildMockProcess({
      id: 9201,
      clients: [client],
      lawyer: { id: lawyerId },
      caseType: "Civil",
      subcase: "Activo",
      ref: "RAD-ACTIVO",
      plaintiff: "Demandante Activo",
      defendant: "Demandado Activo",
      stages: [{ status: "Inicio" }, { status: "Trámite" }],
      progress: 30,
    }),
    buildMockProcess({
      id: 9202,
      clients: [client],
      lawyer: { id: lawyerId },
      caseType: "Laboral",
      subcase: "Cerrado",
      ref: "RAD-CERRADO",
      plaintiff: "Demandante Cerrado",
      defendant: "Demandado Cerrado",
      stages: [{ status: "Inicio" }, { status: "Fallo" }],
      progress: 100,
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

  // View active processes (default)
  await page.goto(`/process_list/${lawyerId}`);

  // Active process should be visible
  await expect(page.getByText("Demandante Activo")).toBeVisible({ timeout: 15_000 });
  // Closed (Fallo) process should NOT be visible in active view
  await expect(page.getByText("Demandante Cerrado")).toHaveCount(0);

  // Switch to history view
  await page.goto(`/process_list/${lawyerId}/history`);

  // Now closed process should be visible
  await expect(page.getByText("Demandante Cerrado")).toBeVisible({ timeout: 15_000 });
  // Active should NOT be visible in history view
  await expect(page.getByText("Demandante Activo")).toHaveCount(0);
});

test("lawyer can search processes by defendant name", async ({ page }) => {
  const lawyerId = 6010;

  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });
  const client1 = {
    id: 6011,
    first_name: "Client",
    last_name: "Alpha",
    email: "alpha@example.com",
    role: "client",
    photo_profile: "",
  };
  const client2 = {
    id: 6012,
    first_name: "Client",
    last_name: "Beta",
    email: "beta@example.com",
    role: "client",
    photo_profile: "",
  };

  const processes = [
    buildMockProcess({
      id: 9301,
      clients: [client1],
      lawyer: { id: lawyerId },
      caseType: "Civil",
      subcase: "Sub1",
      ref: "RAD-301",
      plaintiff: "Juan García",
      defendant: "Pedro López",
      stages: [{ status: "Inicio" }],
      progress: 10,
    }),
    buildMockProcess({
      id: 9302,
      clients: [client2],
      lawyer: { id: lawyerId },
      caseType: "Laboral",
      subcase: "Sub2",
      ref: "RAD-302",
      plaintiff: "María Rodríguez",
      defendant: "Ana Martínez",
      stages: [{ status: "Trámite" }],
      progress: 50,
    }),
  ];

  await installProcessApiMocks(page, {
    userId: lawyerId,
    role: "lawyer",
    processes,
    users: [lawyer, client1, client2],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto(`/process_list/${lawyerId}`);

  // Both processes should be visible initially
  await expect(page.getByText("Juan García")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("María Rodríguez")).toBeVisible();

  // Search by defendant name
  await page.getByPlaceholder("Buscar procesos...").fill("López");

  // Only the matching process should be visible
  await expect(page.getByText("Pedro López")).toBeVisible();
  await expect(page.getByText("Ana Martínez")).toHaveCount(0);

  // Clear search and search by case type
  await page.getByPlaceholder("Buscar procesos...").fill("Laboral");

  await expect(page.getByText("María Rodríguez")).toBeVisible();
  await expect(page.getByText("Juan García")).toHaveCount(0);
});
