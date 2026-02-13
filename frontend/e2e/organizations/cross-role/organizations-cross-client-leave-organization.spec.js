import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { buildMockOrganization, installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("cross-role: client leaves organization and corporate stats + org counts update", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4900;
  const clientUserId = 4901;
  const clientEmail = "leave-me@example.com";

  const seededOrg = buildMockOrganization({
    id: 1,
    title: "Acme Corp",
    description: "Organización de prueba para E2E",
    memberCount: 3,
    pendingInvitationsCount: 1,
  });

  await installOrganizationsDashboardApiMocks(page, {
    userId: corporateUserId,
    role: "corporate_client",
    clientUserId,
    clientUserEmail: clientEmail,
    startWithOrganizations: true,
    seedOrganizations: [seededOrg],
    seedMembersByOrgId: {
      1: [
        {
          id: 3001,
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
          id: clientUserId,
          role: "MEMBER",
          role_display: "Miembro",
          is_active: true,
          joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
          user_info: {
            first_name: "E2E",
            last_name: "Client",
            full_name: "E2E Client",
            email: clientEmail,
            profile_image_url: "",
          },
        },
        {
          id: 3002,
          role: "MEMBER",
          role_display: "Miembro",
          is_active: true,
          joined_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
          user_info: {
            first_name: "Client",
            last_name: "Two",
            full_name: "Client Two",
            email: "client2@example.com",
            profile_image_url: "",
          },
        },
      ],
    },
    startWithClientMemberships: true,
  });

  // Step 1: client leaves (simulate through API; UI flow is covered elsewhere)
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: clientUserId,
      role: "client",
      is_gym_lawyer: false,
      is_profile_completed: true,
      first_name: "E2E",
      last_name: "Client",
      email: clientEmail,
    },
  });

  await page.goto("/organizations_dashboard");
  await expect(page.locator('h1:has-text("Mis Organizaciones")')).toBeVisible();

  const leaveResult = await page.evaluate(async () => {
    const url = new URL("/api/organizations/1/leave/", window.location.origin).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    return { status: res.status, body: await res.json().catch(() => ({})) };
  });

  expect(leaveResult.status).toBe(200);

  await page.goto("/organizations_dashboard");
  await expect(page.locator('h1:has-text("Mis Organizaciones")')).toBeVisible();
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();

  const requestsTab = page.locator('nav[aria-label="Tabs"] button:has-text("Mis Solicitudes")');
  await expect(requestsTab).toBeDisabled();

  // Step 2: corporate sees updated stats and per-org member_count
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: corporateUserId,
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

  const totalMembersStat = page.locator('dt:has-text("Miembros Totales") + dd');
  await expect(totalMembersStat).toHaveText("2");

  const orgCard = page
    .locator("div.bg-white.shadow.rounded-lg.overflow-hidden")
    .filter({ hasText: "Acme Corp" })
    .first();

  await expect(orgCard).toBeVisible();
  await expect(orgCard.getByText("2 miembros")).toBeVisible();
});
