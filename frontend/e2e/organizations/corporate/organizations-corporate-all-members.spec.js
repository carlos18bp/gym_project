import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import {
  buildMockOrganization,
  installOrganizationsDashboardApiMocks,
} from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client can open AllMembersModal and see members grouped by organization", async ({ page }) => {
  const userId = 4600;

  const orgA = buildMockOrganization({
    id: 10,
    title: "Acme Corp",
    description: "Org A",
    memberCount: 2,
    pendingInvitationsCount: 0,
  });

  const orgB = buildMockOrganization({
    id: 11,
    title: "Beta LLC",
    description: "Org B",
    memberCount: 1,
    pendingInvitationsCount: 0,
  });

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: true,
    seedOrganizations: [orgA, orgB],
    seedMembersByOrgId: {
      10: [
        {
          id: 3101,
          role: "ADMIN",
          role_display: "Admin",
          is_active: true,
          joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
          user_info: {
            first_name: "Client",
            last_name: "One",
            full_name: "Client One",
            email: "client@example.com",
            profile_image_url: "",
          },
        },
        {
          id: 3102,
          role: "MEMBER",
          role_display: "Miembro",
          is_active: true,
          joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
          user_info: {
            first_name: "Client",
            last_name: "Two",
            full_name: "Client Two",
            email: "client2@example.com",
            profile_image_url: "",
          },
        },
      ],
      11: [
        {
          id: 3201,
          role: "MEMBER",
          role_display: "Miembro",
          is_active: true,
          joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
          user_info: {
            first_name: "Client",
            last_name: "Three",
            full_name: "Client Three",
            email: "client3@example.com",
            profile_image_url: "",
          },
        },
      ],
    },
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

  // Open All Members modal via stats card "Miembros Totales"
  await page.getByText("Miembros Totales").click();

  await expect(page.getByRole("heading", { name: "Todos los Miembros" })).toBeVisible();

  const allMembersPanel = page
    .locator('div[role="dialog"] div.rounded-lg.bg-white')
    .filter({ hasText: "Todos los Miembros" })
    .first();

  await expect(allMembersPanel).toBeVisible();

  // Header summary: 3 miembros en 2 organizaciones
  await expect(allMembersPanel.getByText("3 miembros en 2 organizaciones")).toBeVisible();

  // Org sections
  const orgASection = allMembersPanel.locator("div.border").filter({ hasText: "Acme Corp" }).first();
  await expect(orgASection.getByText("Acme Corp")).toBeVisible();
  await expect(orgASection.getByText("2 miembros")).toBeVisible();

  const orgBSection = allMembersPanel.locator("div.border").filter({ hasText: "Beta LLC" }).first();
  await expect(orgBSection.getByText("Beta LLC")).toBeVisible();
  await expect(orgBSection.getByText("1 miembro")).toBeVisible();

  // Member visibility
  await expect(allMembersPanel.getByText("Client One")).toBeVisible();
  await expect(allMembersPanel.getByText("client@example.com")).toBeVisible();

  await expect(allMembersPanel.getByText("Client Two")).toBeVisible();
  await expect(allMembersPanel.getByText("client2@example.com")).toBeVisible();

  await expect(allMembersPanel.getByText("Client Three")).toBeVisible();
  await expect(allMembersPanel.getByText("client3@example.com")).toBeVisible();

  // Close using footer button (avoid strict-mode with the X close)
  await allMembersPanel.locator("button.inline-flex.w-full").filter({ hasText: "Cerrar" }).click();
  await expect(page.getByRole("heading", { name: "Todos los Miembros" })).toHaveCount(0);
});
