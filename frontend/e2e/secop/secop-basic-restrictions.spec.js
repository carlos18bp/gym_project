import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installSecopApiMocks } from "./secopMocks.js";

/**
 * Role variant of secop-list-browse: the basic role sees the module with
 * filters and alerts locked behind upgrade overlays.
 */

test(
  "basic role sees SECOP with filters and alerts locked behind upgrade overlays",
  { tag: ["@flow:secop-list-browse", "@module:secop", "@priority:P3", "@role:basic"] },
  async ({ page }) => {
    await installSecopApiMocks(page, {
      userId: 9905,
      user: { role: "basic", is_gym_lawyer: false },
    });
    await setAuthLocalStorage(page, {
      token: "e2e-secop-token",
      userAuth: { id: 9905, role: "basic", is_profile_completed: true },
    });

    await page.goto("/secop");

    await expect(page.getByTestId("secop-table")).toBeVisible({ timeout: 15_000 });

    const filtersOverlay = page.getByTestId("filters-disabled-overlay");
    await expect(filtersOverlay).toBeVisible();
    await expect(filtersOverlay).toContainText("Activa todas las funcionalidades");

    await page.getByRole("button", { name: /Alertas/ }).click();
    await expect(page.getByTestId("alerts-disabled-overlay")).toBeVisible();
  }
);
