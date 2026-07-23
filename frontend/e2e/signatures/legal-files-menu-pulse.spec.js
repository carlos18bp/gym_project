import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks } from "../helpers/dynamicDocumentMocks.js";
import { LEGAL_FILES_MENU_PULSE } from "../helpers/flow-tags.js";

/**
 * E2E for legal-files-menu-pulse (Req #6).
 *
 * The user starts on the dashboard, sees the pulsing alert with the pending
 * count on the "Archivos Juridicos" entry, and clicks it. Both tests drive
 * that click: one asserts it lands on the documents module, the other asserts
 * the session is marked as alerted only after the visit happens.
 */

test(
  "lawyer follows the pulsing Archivos Juridicos badge to the documents module",
  { tag: [...LEGAL_FILES_MENU_PULSE, "@role:lawyer"] },
  async ({ page }) => {
    const userId = 9001;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: true,
      pendingSignaturesCount: 3,
    });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: userId,
        role: "lawyer",
        is_gym_lawyer: true,
        is_profile_completed: true,
      },
    });

    await page.goto("/dashboard");

    await page.getByText("Archivos Juridicos").first().waitFor({ timeout: 15_000 });
    await expect(page.getByTestId("pending-signatures-indicator")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("pending-signatures-count")).toHaveText("3");

    await page.getByText("Archivos Juridicos").first().click();

    await expect(page).toHaveURL(/\/dynamic_document_dashboard/, { timeout: 15_000 });
    await expect(page.getByTestId("pending-signatures-count")).toHaveText("3");
  }
);

test(
  "navigating to Archivos Juridicos persists the alerted-flag in sessionStorage",
  { tag: [...LEGAL_FILES_MENU_PULSE, "@role:client"] },
  async ({ page }) => {
    const userId = 9002;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: true,
      pendingSignaturesCount: 1,
    });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: userId,
        role: "client",
        is_gym_lawyer: false,
        is_profile_completed: true,
      },
    });

    await page.goto("/dashboard");

    await page.getByText("Archivos Juridicos").first().waitFor({ timeout: 15_000 });

    // The flag is only written by the documents module, never by the dashboard
    expect(
      await page.evaluate(() => sessionStorage.getItem("pendingSignaturesAlerted"))
    ).toBeNull();

    await page.getByText("Archivos Juridicos").first().click();

    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            sessionStorage.getItem("pendingSignaturesAlerted")
          ),
        { timeout: 15_000 }
      )
      .toBe("true");
  }
);
