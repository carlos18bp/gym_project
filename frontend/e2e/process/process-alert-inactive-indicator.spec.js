import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installProcessApiMocks,
  buildMockProcess,
  buildMockUser,
} from "../helpers/processMocks.js";

/**
 * E2E for the StageAlert indicator absence (@flow:process-alerts): when the
 * last stage's alert is deactivated, ProcessDetail must not render the
 * "Alerta activa" indicator at all.
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
  "alert indicator is hidden when the stage alert is inactive",
  TAGS,
  async ({ page }) => {
    const lawyerId = 9300;
    const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", isGymLawyer: true });
    const process = buildMockProcess({
      id: 9301,
      clients: [],
      lawyer: { id: lawyerId },
      caseType: "Civil",
      subcase: "Contractual",
      ref: "RAD-9301",
      authority: "Juzgado 1",
      plaintiff: "Demandante",
      defendant: "Demandado",
      stages: [
        {
          id: 931,
          status: "Audiencia",
          date: "2099-06-15",
          alert: {
            id: 2,
            is_active: false,
            notify_clients: true,
            description: "",
          },
        },
      ],
      progress: 50,
    });

    await installProcessApiMocks(page, {
      userId: lawyerId,
      role: "lawyer",
      processes: [process],
      users: [lawyer],
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
    await expect(page.getByText("Audiencia").first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/Alerta activa/)).toHaveCount(0);
  }
);
