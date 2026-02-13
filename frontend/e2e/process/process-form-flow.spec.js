import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessFormApiMocks,
  buildMockUser,
} from "../helpers/processFormMocks.js";

test("lawyer can create a process from ProcessForm", async ({ page }) => {
  const lawyerId = 1400;
  const clientId = 1401;

  const lawyer = buildMockUser({
    id: lawyerId,
    role: "lawyer",
    firstName: "E2E",
    lastName: "Lawyer",
    isGymLawyer: true,
  });

  const client = buildMockUser({
    id: clientId,
    role: "client",
    firstName: "Client",
    lastName: "One",
    email: "client@example.com",
    isGymLawyer: false,
  });

  await installProcessFormApiMocks(page, {
    lawyer,
    client,
    caseTypes: [{ id: 1, type: "Civil" }],
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

  await page.goto("/process_form/add");

  await expect(page.getByRole("heading", { name: "Información del proceso" })).toBeVisible();

  await page.locator("#plaintiff").first().fill("Demandante");
  await page.locator("#defendant").first().fill("Demandado");

  // Tipo Proceso combobox
  await page.getByRole("button", { name: "Seleccionar" }).first().click();
  await page.getByRole("option", { name: "Civil" }).click();

  // Subclase is the 2nd input with id=defendant (buggy duplicate id), select the second one.
  await page.locator("input#defendant").nth(1).fill("Subcaso");

  // Radicado uses duplicate id=plaintiff, pick the second one.
  await page.locator("input#plaintiff").nth(1).fill("RAD-9002");

  await page.locator("#authority").fill("Juzgado 1");

  // Add at least one user
  await page.getByPlaceholder("Buscar y agregar usuarios").fill("Client");
  await page.getByRole("option", { name: /One Client/i }).click();

  // Fill first stage
  await page.locator("input#stage").first().fill("Inicio");

  // Attach required file
  await page.locator("input[type='file']").first().setInputFiles({
    name: "case.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n", "utf-8"),
  });

  await page.getByRole("button", { name: "Guardar Proceso" }).click();

  // submitHandler shows a success SweetAlert
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-popup")).toContainText("Exitoso");
  await page.locator(".swal2-confirm").click();

  await expect(page).toHaveURL(/\/process_list/);
  await expect(page.getByPlaceholder("Buscar procesos...")).toBeVisible();
});
