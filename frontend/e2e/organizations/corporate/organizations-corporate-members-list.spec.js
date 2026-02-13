import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client can open organization members list modal", async ({ page }) => {
  const userId = 4500;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: true,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "corporate_client",
      is_gym_lawyer: false,
      is_profile_completed: true,
      first_name: "E2E",
      last_name: "Corporate",
      email: "corp@example.com",
    },
  });

  await page.goto("/organizations_dashboard");

  await expect(page.locator('h1:has-text("Panel Corporativo")')).toBeVisible();

  // Open members modal via the "2 miembros" button on the organization card
  const orgCard = page.locator('div:has(h3:has-text("Acme Corp"))').first();
  await expect(orgCard.getByRole("button", { name: /miembros/ })).toBeVisible();
  await orgCard.getByRole("button", { name: /miembros/ }).click();

  await expect(page.getByRole("heading", { name: "Miembros de Acme Corp" })).toBeVisible();

  const membersPanel = page
    .locator('div[role="dialog"] div.rounded-lg.bg-white')
    .filter({ hasText: "Miembros de Acme Corp" })
    .first();
  await expect(membersPanel).toBeVisible();

  // Validate members
  await expect(membersPanel.getByText("Client One")).toBeVisible();
  await expect(membersPanel.getByText("client@example.com")).toBeVisible();
  await expect(membersPanel.getByText("Admin")).toBeVisible();

  await expect(membersPanel.getByText("Client Two")).toBeVisible();
  await expect(membersPanel.getByText("client2@example.com")).toBeVisible();
  const memberTwoItem = membersPanel.locator("li").filter({ hasText: "client2@example.com" }).first();
  await expect(memberTwoItem.getByText("Miembro", { exact: true })).toBeVisible();

  // Close modal
  await membersPanel.locator("button.inline-flex.w-full").filter({ hasText: "Cerrar" }).click();
  await expect(page.getByRole("heading", { name: "Miembros de Acme Corp" })).toHaveCount(0);
});
