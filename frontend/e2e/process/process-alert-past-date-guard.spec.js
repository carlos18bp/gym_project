// quality: disable fragile_test_data (emails are mock credentials used only for API route interception, not real production data)
import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessFormApiMocks,
  buildMockUser,
} from "../helpers/processFormMocks.js";

/**
 * E2E for the StageAlert past-date guard (@flow:process-alerts): reminders
 * cannot be scheduled for a stage whose date already passed — ProcessForm
 * shows the warning, forces the alert off and blocks re-activation.
 */

const TAGS = {
  tag: [
    "@flow:process-alerts",
    "@module:processes",
    "@priority:P2",
    "@role:lawyer",
  ],
};

test(
  "past stage date deactivates the alert and blocks the toggle",
  TAGS,
  async ({ page }) => {
    test.setTimeout(60_000);
    const lawyerId = 9400;
    const clientId = 9401;

    await installProcessFormApiMocks(page, {
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
    await expect(
      page.getByRole("heading", { name: "Información del proceso" })
    ).toBeVisible({ timeout: 15_000 });

    await page.locator('input[name="stage"]:visible').fill("Audiencia vencida");
    await page.locator('input[name="stage_date"]:visible').fill("2020-01-01");

    await expect(page.getByTestId("alert-past-date-warning")).toBeVisible();

    const activeToggle = page.getByTestId("alert-active-toggle");
    await expect(activeToggle).toHaveClass(/bg-gray-200/);
    await expect(activeToggle).toBeDisabled();
  }
);
