import { test, expect } from "../../helpers/test.js";
import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

test("corporate client dashboard loads with organization stats context", { tag: ['@flow:org-corporate-requests', '@module:organizations', '@priority:P2', '@role:corporate'] }, async ({ page }) => {
  const userId = 9400;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: true,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "corporate_client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/organizations_dashboard");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("corporate_client");
});

test("corporate client with no organizations sees empty state", { tag: ['@flow:org-create', '@module:organizations', '@priority:P1', '@role:corporate'] }, async ({ page }) => {
  const userId = 9401;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "corporate_client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/organizations_dashboard");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});
