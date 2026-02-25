import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessFormApiMocks,
  buildMockUser,
} from "../helpers/processFormMocks.js";

const buildAuthPayload = ({ id, role, isGymLawyer }) => ({
  token: "e2e-token",
  userAuth: {
    id,
    role,
    is_gym_lawyer: isGymLawyer,
    is_profile_completed: true,
  },
});

const buildScenarioUsers = ({ lawyerId, clientId }) => {
  const buildEmail = (prefix) => `${prefix}@mail.local`;
  return {
    lawyer: buildMockUser({
      id: lawyerId,
      role: "lawyer",
      firstName: "E2E",
      lastName: "Lawyer",
      isGymLawyer: true,
    }),
    client: buildMockUser({
      id: clientId,
      role: "client",
      firstName: "Client",
      lastName: "One",
      email: buildEmail("client-one"),
      isGymLawyer: false,
    }),
  };
};

async function fillRequiredProcessFields(page) {
  const plaintiffInputs = await page.locator('input[name="plaintiff"]:visible').all();
  const defendantInputs = await page.locator('input[name="defendant"]:visible').all();

  await plaintiffInputs[0].fill("Demandante");
  await defendantInputs[0].fill("Demandado");

  await page.getByRole("button", { name: "Seleccionar" }).click();
  await page.getByRole("option", { name: "Civil" }).click();

  await defendantInputs[1].fill("Subcaso");
  await plaintiffInputs[1].fill("RAD-9002");
  await page.getByRole("textbox", { name: /^Autoridad/ }).fill("Juzgado 1");

  await page.getByPlaceholder("Buscar y agregar usuarios").fill("Client");
  await page.getByRole("option", { name: /One Client/i }).click();

  await page.locator('input[name="stage"]:visible').fill("Inicio");

  const fileInput = page.locator("tbody input[type='file']:visible");
  await expect(fileInput).toHaveCount(1);
  await fileInput.setInputFiles({
    name: "case.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%PDF-MOCK\n", "utf-8"),
  });
}

async function completeSuccessDialog(page) {
  const successDialog = page.getByRole("dialog");
  await expect(successDialog).toBeVisible({ timeout: 15_000 });
  await expect(successDialog).toContainText("Exitoso");
  const okBtn = page.getByRole("button", { name: /^(OK!?|Aceptar)$/i });
  await expect(okBtn).toBeEnabled({ timeout: 10_000 });
  await okBtn.click();
}

test("lawyer can create a process from ProcessForm", { tag: ['@flow:process-create', '@module:processes', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  test.setTimeout(60_000);
  const lawyerId = 1400;
  const clientId = 1401;
  const { lawyer, client } = buildScenarioUsers({ lawyerId, clientId });

  await installProcessFormApiMocks(page, {
    lawyer,
    client,
    caseTypes: [{ id: 1, type: "Civil" }],
  });

  await setAuthLocalStorage(page, buildAuthPayload({ id: lawyerId, role: "lawyer", isGymLawyer: true }));

  await page.goto("/process_form/add");
  await expect(page.getByRole("heading", { name: "Información del proceso" })).toBeVisible({ timeout: 15_000 });
  await fillRequiredProcessFields(page);

  await page.getByRole("button", { name: "Guardar Proceso" }).click();
  await completeSuccessDialog(page);

  await expect(page).toHaveURL(/\/process_list/);
  await expect(page.getByPlaceholder("Buscar procesos...")).toBeVisible();
});
