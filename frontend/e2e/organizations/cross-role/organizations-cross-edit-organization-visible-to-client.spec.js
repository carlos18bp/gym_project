import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import {
  buildMockOrganization,
  installOrganizationsDashboardApiMocks,
} from "../../helpers/organizationsDashboardMocks.js";

test("cross-role: corporate edits organization and client sees updated title/description", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 5000;
  const clientUserId = 5001;
  const clientEmail = "cross-org-edit-client@example.com";

  const seededOrg = buildMockOrganization({
    id: 1,
    title: "Acme Corp",
    description: "Org original",
    memberCount: 2,
    pendingInvitationsCount: 0,
  });

  await installOrganizationsDashboardApiMocks(page, {
    userId: corporateUserId,
    role: "corporate_client",
    clientUserId,
    clientUserEmail: clientEmail,
    startWithOrganizations: true,
    seedOrganizations: [seededOrg],
    seedReceivedRequests: [],
    startWithClientMemberships: true,
  });

  // Step 1: client sees baseline org title/description
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
  await expect(page.getByRole("heading", { name: "Acme Corp" }).first()).toBeVisible();
  await expect(page.getByText("Org original").first()).toBeVisible();

  // Step 2: corporate edits organization
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

  const orgCard = page.locator('div:has(h3:has-text("Acme Corp"))').first();
  await orgCard.getByRole("button", { name: "Editar" }).click();

  await expect(page.getByRole("heading", { name: "Editar Organización" })).toBeVisible();

  await page.locator("input#title").fill("Acme Corp Editada");
  await page.locator("textarea#description").fill("Descripción editada cross-role");

  await page.getByRole("button", { name: "Guardar Cambios" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Organización actualizada exitosamente");
  await page.locator(".swal2-confirm").click();

  await expect(page.getByRole("heading", { name: "Editar Organización" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Acme Corp Editada" }).first()).toBeVisible();

  // Step 3: client sees updated title/description
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
  await expect(page.getByRole("heading", { name: "Acme Corp Editada" }).first()).toBeVisible();
  await expect(page.getByText("Descripción editada cross-role").first()).toBeVisible();
});
