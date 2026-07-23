import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installSecopApiMocks } from "./secopMocks.js";

const LAWYER_AUTH = {
  token: "e2e-secop-token",
  userAuth: {
    id: 9901,
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
  },
};

test.describe("SECOP Admin Sync Flow", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page);
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  // NOTE: a second "lawyer can trigger manual sync and see confirmation" case
  // used to live here guarded by `if (await syncBtn.isVisible())`, so it proved
  // nothing beyond the panel still rendering. It is covered by the assertions
  // below without the conditional.
  test("triggering a manual sync puts the sync button in its in-flight state", {
    tag: ['@flow:secop-trigger-sync', '@module:secop', '@priority:P4', '@role:lawyer'],
  }, async ({ page }) => {
    await page.goto("/secop");

    // Starting point: the sync control is idle and clickable
    const syncBtn = page.getByTestId("sync-trigger-btn");
    await expect(syncBtn).toBeEnabled();
    await expect(syncBtn).toContainText("Sincronizar");
    await expect(syncBtn).toHaveAttribute("title", "Sincronizar ahora");

    await syncBtn.click();

    // Transition: the button locks itself and reports the sync in progress
    await expect(syncBtn).toBeDisabled();
    await expect(syncBtn).toContainText("Sincronizando");
    await expect(syncBtn).toHaveAttribute("title", "Sincronizando...");
  });
});
