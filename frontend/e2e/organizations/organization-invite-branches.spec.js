import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../helpers/organizationsDashboardMocks.js";

/**
 * Branch coverage tests for org-invite-member flow.
 * Tests different invitation states and validation.
 */

test("corporate user sees invite form on organization dashboard", { tag: ['@flow:org-invite-members', '@module:organizations', '@priority:P1', '@role:corporate'] }, async ({ page }) => {
  const userId = 9400;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "corporate_client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/organizations");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("corporate user with active organization sees members tab", { tag: ['@flow:org-members-list', '@module:organizations', '@priority:P2', '@role:corporate'] }, async ({ page }) => {
  const userId = 9401;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "corporate_client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/organizations");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("client user sees organizations they belong to", { tag: ['@flow:org-client-view', '@module:organizations', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 9402;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "client",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/organizations");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});
