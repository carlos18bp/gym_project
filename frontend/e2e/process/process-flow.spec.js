import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessApiMocks,
  buildMockProcess,
  buildMockUser,
} from "../helpers/processMocks.js";

test("lawyer can view process list and open process detail", async ({ page }) => {
  const lawyerId = 700;
  const clientId = 701;
  const processId = 9001;

  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });
  const client = {
    id: clientId,
    first_name: "Client",
    last_name: "One",
    email: "client@example.com",
    role: "client",
    photo_profile: "",
  };

  const processes = [
    buildMockProcess({
      id: processId,
      clients: [client],
      lawyer: { id: lawyerId },
      caseType: "Civil",
      subcase: "Subcaso A",
      ref: "RAD-9001",
      authority: "Juzgado 1",
      authorityEmail: "juzgado1@example.com",
      plaintiff: "Demandante",
      defendant: "Demandado",
      stages: [{ status: "Inicio" }, { status: "Trámite" }],
      progress: 20,
      caseFiles: [],
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
    userAuth: {
      id: lawyerId,
      role: "lawyer",
      is_gym_lawyer: true,
      is_profile_completed: true,
    },
  });

  await page.goto(`/process_list/${lawyerId}`);

  await expect(page.getByPlaceholder("Buscar procesos...")).toBeVisible();
  await expect(page.getByText("Client One")).toBeVisible();
  await expect(page.getByText("Civil")).toBeVisible();
  await expect(page.getByText("Demandante")).toBeVisible();
  await expect(page.getByText("Demandado")).toBeVisible();
  await expect(page.getByText("Trámite")).toBeVisible();
  await expect(page.getByText("20%")).toBeVisible();

  await page.getByRole("row", { name: /Client One/ }).click();

  await expect(page).toHaveURL(new RegExp(`/process_detail/${processId}`));

  // Detail view should show key fields
  await expect(page.getByRole("heading", { name: "Civil" })).toBeVisible();
  await expect(page.getByText("Subcaso A")).toBeVisible();
  await expect(page.getByText("Juzgado 1")).toBeVisible();
  await expect(page.getByText("RAD-9001")).toBeVisible();
});

test("client sees only their processes in My Processes and can search", async ({ page }) => {
  const clientId = 710;
  const otherClientId = 711;

  const client = buildMockUser({ id: clientId, role: "client" });
  const otherClient = {
    id: otherClientId,
    first_name: "Other",
    last_name: "Client",
    email: "other@example.com",
    role: "client",
    photo_profile: "",
  };

  const processes = [
    buildMockProcess({
      id: 9101,
      clients: [{ id: clientId, first_name: "E2E", last_name: "Client", email: "e2e@example.com", role: "client", photo_profile: "" }],
      lawyer: { id: 999 },
      caseType: "Laboral",
      subcase: "Caso Laboral",
      ref: "RAD-9101",
      authority: "Juzgado Laboral",
      plaintiff: "P1",
      defendant: "D1",
      stages: [{ status: "Inicio" }],
      progress: 5,
    }),
    buildMockProcess({
      id: 9102,
      clients: [otherClient],
      lawyer: { id: 999 },
      caseType: "Civil",
      subcase: "Caso Ajeno",
      ref: "RAD-9102",
      authority: "Juzgado 2",
      plaintiff: "P2",
      defendant: "D2",
      stages: [{ status: "Inicio" }],
      progress: 5,
    }),
  ];

  await installProcessApiMocks(page, {
    userId: clientId,
    role: "client",
    processes,
    users: [client, otherClient],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: clientId,
      role: "client",
      is_profile_completed: true,
    },
  });

  await page.goto(`/process_list/${clientId}`);

  await expect(page.getByText("Laboral")).toBeVisible();
  const myRow = page.getByRole("row", { name: /E2E Client.*e2e@example\.com.*Laboral/ });
  await expect(myRow).toBeVisible();

  // Should be filtered out by tab logic (my_processes)
  await expect(page.getByText("Other Client")).toHaveCount(0);
  await expect(page.getByText("other@example.com")).toHaveCount(0);

  await page.getByPlaceholder("Buscar procesos...").fill("Laboral");
  await expect(page.getByText("Laboral")).toBeVisible();
});
