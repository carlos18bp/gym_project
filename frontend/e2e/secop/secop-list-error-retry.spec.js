import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installSecopApiMocks } from "./secopMocks.js";

/**
 * E2E for secop-list-error-retry: a failed SECOP list load shows the error
 * state and the "Reintentar" button reloads the list successfully.
 */

test(
  "failed SECOP load recovers through the retry button",
  { tag: ["@flow:secop-list-error-retry", "@module:secop", "@priority:P4", "@role:lawyer"] },
  async ({ page }) => {
    await installSecopApiMocks(page);

    // First processes fetch fails; the retry falls through to the shared mocks.
    let failedOnce = false;
    await page.route("**/api/secop/processes/**", async (route) => {
      if (!failedOnce) {
        failedOnce = true;
        return route.fulfill({ status: 500, contentType: "application/json", body: '{"detail":"boom"}' });
      }
      return route.fallback();
    });

    await setAuthLocalStorage(page, {
      token: "e2e-secop-token",
      userAuth: { id: 9901, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/secop");

    const retry = page.getByRole("button", { name: "Reintentar" });
    await expect(retry).toBeVisible({ timeout: 15_000 });

    await retry.click();

    await expect(page.getByTestId("secop-table")).toBeVisible({ timeout: 15_000 });
    await expect(retry).toHaveCount(0);
  }
);
