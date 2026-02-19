import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessFormApiMocks,
  buildMockUser,
} from "../helpers/processFormMocks.js";

/**
 * Deep coverage for ProcessForm.vue validation:
 * - Save button disabled when required fields are empty
 * - Validation fires SweetAlert for missing fields
 * - Adding/removing stages
 * - Cancel button navigates back
 */

function setupLawyerAndClient() {
  const lawyerId = 9400;
  const clientId = 9401;
  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", firstName: "E2E", lastName: "Lawyer", isGymLawyer: true });
  const client = buildMockUser({ id: clientId, role: "client", firstName: "Client", lastName: "One", email: "client@example.com", isGymLawyer: false });
  return { lawyerId, clientId, lawyer, client };
}

function getVisibleStageInputs(page) {
  return page.locator('input[name="stage"]:visible');
}

async function fillRequiredFormFields(page, { plaintiff, defendant, subcase, reference, authority, stage }) {
  const plaintiffInputs = await page.locator('input[name="plaintiff"]:visible').all();
  const defendantInputs = await page.locator('input[name="defendant"]:visible').all();

  await plaintiffInputs[0].fill(plaintiff);
  await defendantInputs[0].fill(defendant);
  await page.getByRole("button", { name: "Seleccionar" }).click();
  await page.getByText("Civil", { exact: true }).click();
  await defendantInputs[1].fill(subcase);
  await plaintiffInputs[1].fill(reference);
  await page.getByRole("textbox", { name: /^Autoridad/ }).fill(authority);
  await getVisibleStageInputs(page).fill(stage);
}

test("process form renders with all required fields and save button disabled initially", async ({ page }) => {
  const { lawyerId, lawyer, client } = setupLawyerAndClient();

  await installProcessFormApiMocks(page, {
    lawyer,
    client,
    caseTypes: [{ id: 1, type: "Civil" }, { id: 2, type: "Penal" }],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_form/add");

  // Page heading
  await expect(page.getByRole("heading", { name: "Información del proceso" })).toBeVisible({ timeout: 15_000 });

  // Required field labels should be visible
  await expect(page.getByText("Dte./Accionante")).toBeVisible();
  await expect(page.getByText("Ddo./Accionado")).toBeVisible();
  await expect(page.getByText("Tipo Proceso")).toBeVisible();
  await expect(page.getByText("Subclase")).toBeVisible();
  await expect(page.getByText("Radicado")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Autoridad/ })).toBeVisible();

  // Save button should be disabled (no required fields filled)
  const saveBtn = page.getByRole("button", { name: "Guardar Proceso" });
  await expect(saveBtn).toBeVisible();
  await expect(saveBtn).toBeDisabled();

  // Cancel button should be visible
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
});

test("save button becomes enabled when all required fields are filled", async ({ page }) => {
  const { lawyerId, lawyer, client } = setupLawyerAndClient();

  await installProcessFormApiMocks(page, {
    lawyer,
    client,
    caseTypes: [{ id: 1, type: "Civil" }],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_form/add");
  await expect(page.getByRole("heading", { name: "Información del proceso" })).toBeVisible({ timeout: 15_000 });

  await fillRequiredFormFields(page, {
    plaintiff: "Demandante Test",
    defendant: "Demandado Test",
    subcase: "Subcaso Test",
    reference: "RAD-001",
    authority: "Juzgado 1",
    stage: "Etapa Inicial",
  });

  // Save button should now be enabled
  const saveBtn = page.getByRole("button", { name: "Guardar Proceso" });
  await expect(saveBtn).toBeEnabled();
});

test("clicking Guardar Proceso with missing case type shows validation warning", async ({ page }) => {
  const { lawyerId, lawyer, client } = setupLawyerAndClient();

  await installProcessFormApiMocks(page, {
    lawyer,
    client,
    caseTypes: [{ id: 1, type: "Civil" }],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_form/add");
  await expect(page.getByRole("heading", { name: "Información del proceso" })).toBeVisible({ timeout: 15_000 });

  // Fill most fields but leave case type empty
  const plaintiffInputs = await page.locator('input[name="plaintiff"]:visible').all();
  const defendantInputs = await page.locator('input[name="defendant"]:visible').all();

  await plaintiffInputs[0].fill("Demandante");
  await defendantInputs[0].fill("Demandado");
  // Skip case type selection
  await defendantInputs[1].fill("Subcaso");
  await plaintiffInputs[1].fill("RAD-002");
  await page.getByRole("textbox", { name: /^Autoridad/ }).fill("Juzgado 2");
  await getVisibleStageInputs(page).fill("Etapa Inicial");

  // Save button is enabled (isSaveButtonEnabled doesn't check caseTypeId).
  // validateFormData() checks caseTypeId at submit time and shows SweetAlert warning.
  const saveBtn = page.getByRole("button", { name: "Guardar Proceso" });
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();

  // Should show validation warning about missing "Tipo de Caso"
  const validationDialog = page.getByRole("dialog");
  await expect(validationDialog).toBeVisible({ timeout: 10_000 });
  await expect(validationDialog).toContainText("Tipo de Caso");
  await expect(validationDialog).toContainText("obligatorio");
});

test("lawyer can add process stages", async ({ page }) => {
  const { lawyerId, lawyer, client } = setupLawyerAndClient();

  await installProcessFormApiMocks(page, {
    lawyer,
    client,
    caseTypes: [{ id: 1, type: "Civil" }],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/process_form/add");
  await expect(page.getByRole("heading", { name: "Información del proceso" })).toBeVisible({ timeout: 15_000 });

  const stageInputs = getVisibleStageInputs(page);

  // Initially there should be 1 stage row in the desktop table
  await expect(stageInputs).toHaveCount(1);

  // Click "Nuevo" in the stages table to add another stage row
  const stagesTable = page.locator("table", { has: page.getByText("Etapa Procesal") });
  await stagesTable.getByRole("button", { name: "Nuevo" }).click();

  // Now should be 2 stage rows
  await expect(stageInputs).toHaveCount(2);

  // Fill both stages
  const visibleStageInputs = await stageInputs.all();
  await visibleStageInputs[0].fill("Etapa 1");
  await visibleStageInputs[1].fill("Etapa 2");

  // Verify both filled
  await expect(visibleStageInputs[0]).toHaveValue("Etapa 1");
  await expect(visibleStageInputs[1]).toHaveValue("Etapa 2");
});

test("cancel button navigates away from the form", async ({ page }) => {
  const { lawyerId, lawyer, client } = setupLawyerAndClient();

  await installProcessFormApiMocks(page, {
    lawyer,
    client,
    caseTypes: [{ id: 1, type: "Civil" }],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  // Navigate to form via process_list so router.back() works
  await page.goto("/process_form/add");
  await expect(page.getByRole("heading", { name: "Información del proceso" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Cancelar" }).click();

  // Should navigate away from the form (back or to process list)
  await expect(page).not.toHaveURL(/\/process_form/, { timeout: 10_000 });
});
