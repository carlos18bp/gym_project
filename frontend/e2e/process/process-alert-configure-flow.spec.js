import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessFormApiMocks,
  buildMockUser,
} from "../helpers/processFormMocks.js";

/**
 * E2E for the interactive StageAlert configuration in ProcessForm
 * (@flow:process-alert-configure): the lawyer toggles "Notificar también a
 * los clientes" (notify_clients), adds a custom description and saves; the
 * submitted mainData must persist the chosen alert configuration.
 */

const TAGS = {
  tag: [
    "@flow:process-alert-configure",
    "@module:processes",
    "@priority:P2",
    "@role:lawyer",
  ],
};

const buildAuthPayload = ({ id, role, isGymLawyer }) => ({
  token: "e2e-token",
  userAuth: {
    id,
    role,
    is_gym_lawyer: isGymLawyer,
    is_profile_completed: true,
  },
});

const buildScenarioUsers = ({ lawyerId, clientId }) => ({
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
    email: "client-one@mail.local",
    isGymLawyer: false,
  }),
});

async function fillRequiredProcessFields(page) {
  const plaintiffInputs = await page.locator('input[name="plaintiff"]:visible').all();
  const defendantInputs = await page.locator('input[name="defendant"]:visible').all();

  await plaintiffInputs[0].fill("Demandante");
  await defendantInputs[0].fill("Demandado");

  await page.getByRole("button", { name: "Seleccionar" }).click();
  await page.getByRole("option", { name: "Civil" }).click();

  await defendantInputs[1].fill("Subcaso");
  await plaintiffInputs[1].fill("RAD-9200");
  await page.getByRole("textbox", { name: /^Autoridad/ }).fill("Juzgado 1");

  await page.getByPlaceholder("Buscar y agregar usuarios").fill("Client");
  await page.getByRole("option", { name: /One Client/i }).click();

  await page.locator('input[name="stage"]:visible').fill("Audiencia inicial");
  await page.locator('input[name="stage_date"]:visible').fill("2099-12-31");

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

async function setupCreateForm(page, { lawyerId, clientId }) {
  const { lawyer, client } = buildScenarioUsers({ lawyerId, clientId });

  await installProcessFormApiMocks(page, {
    lawyer,
    client,
    caseTypes: [{ id: 1, type: "Civil" }],
  });

  const submitted = [];
  await page.route("**/create_process/", async (route) => {
    submitted.push(route.request());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: 9200 }),
    });
  });

  await setAuthLocalStorage(
    page,
    buildAuthPayload({ id: lawyerId, role: "lawyer", isGymLawyer: true })
  );
  await page.goto("/process_form/add");
  await expect(
    page.getByRole("heading", { name: "Información del proceso" })
  ).toBeVisible({ timeout: 15_000 });

  return submitted;
}

function parseMainData(request) {
  const body = request.postData() || "";
  const match = body.match(/name="mainData"\s*\r?\n\r?\n([\s\S]*?)\r?\n--/);
  expect(match, "mainData part present in multipart body").not.toBeNull();
  return JSON.parse(match[1]);
}

test(
  "lawyer enables client notifications and custom description on the stage alert",
  TAGS,
  async ({ page }) => {
    test.setTimeout(60_000);
    const submitted = await setupCreateForm(page, { lawyerId: 1500, clientId: 1501 });

    await fillRequiredProcessFields(page);

    const activeToggle = page.getByTestId("alert-active-toggle");
    await expect(activeToggle).toBeVisible();
    await expect(activeToggle).toHaveClass(/bg-blue-600/);

    const notifyToggle = page.getByTestId("alert-notify-clients-toggle");
    await expect(notifyToggle).toHaveClass(/bg-blue-600/);
    await notifyToggle.click();
    await expect(notifyToggle).toHaveClass(/bg-gray-200/);
    await notifyToggle.click();
    await expect(notifyToggle).toHaveClass(/bg-blue-600/);

    await page
      .getByTestId("alert-description-input")
      .fill("Recordar presentar memorial ante el juzgado");

    await page.getByRole("button", { name: "Guardar Proceso" }).click();
    await completeSuccessDialog(page);
    await expect(page).toHaveURL(/\/process_list/);

    expect(submitted).toHaveLength(1);
    const mainData = parseMainData(submitted[0]);
    expect(mainData.alertIsActive).toBe(true);
    expect(mainData.alertNotifyClients).toBe(true);
    expect(mainData.alertDescription).toBe(
      "Recordar presentar memorial ante el juzgado"
    );
  }
);

test(
  "lawyer can deactivate the stage alert before saving",
  TAGS,
  async ({ page }) => {
    test.setTimeout(60_000);
    const submitted = await setupCreateForm(page, { lawyerId: 1502, clientId: 1503 });

    await fillRequiredProcessFields(page);

    const activeToggle = page.getByTestId("alert-active-toggle");
    await activeToggle.click();
    await expect(activeToggle).toHaveClass(/bg-gray-200/);

    await page.getByRole("button", { name: "Guardar Proceso" }).click();
    await completeSuccessDialog(page);

    expect(submitted).toHaveLength(1);
    const mainData = parseMainData(submitted[0]);
    expect(mainData.alertIsActive).toBe(false);
  }
);
