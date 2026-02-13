import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import {
  buildMockOrganization,
  installOrganizationsDashboardApiMocks,
} from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client dashboard empty state: no organizations and no received requests", async ({ page }) => {
  const userId = 4800;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: false,
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

  // Organizations empty state
  await expect(page.getByText("No tienes organizaciones creadas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear Organización" })).toBeVisible();

  // Stats should show 0s
  await expect(page.locator('dt:has-text("Organizaciones") + dd')).toHaveText("0");
  await expect(page.locator('dt:has-text("Miembros Totales") + dd')).toHaveText("0");
  await expect(page.locator('dt:has-text("Invitaciones Pendientes") + dd')).toHaveText("0");
  await expect(page.locator('dt:has-text("Total Solicitudes") + dd')).toHaveText("0");

  // Received requests empty state
  await expect(page.locator('h2:has-text("Solicitudes Recibidas")')).toBeVisible();
  await expect(page.getByText("No has recibido solicitudes")).toBeVisible();
  await expect(page.getByText("¿Por qué no hay solicitudes?"))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "Limpiar Filtros" })).toHaveCount(0);
});

test("corporate_client dashboard empty state: organizations exist but no received requests", async ({ page }) => {
  const userId = 4801;

  const orgA = buildMockOrganization({
    id: 10,
    title: "Acme Corp",
    description: "Org A",
    memberCount: 2,
    pendingInvitationsCount: 0,
  });

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
    startWithOrganizations: true,
    seedOrganizations: [orgA],
    seedReceivedRequests: [],
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

  // Organization is present
  await expect(page.locator('h3:has-text("Acme Corp")')).toBeVisible();
  await expect(page.getByText("No tienes organizaciones creadas")).toHaveCount(0);

  // Total requests stat should be 0
  await expect(page.locator('dt:has-text("Total Solicitudes") + dd')).toHaveText("0");

  // Received requests empty state
  await expect(page.locator('h2:has-text("Solicitudes Recibidas")')).toBeVisible();
  await expect(page.getByText("No has recibido solicitudes")).toBeVisible();
  await expect(page.getByText("¿Por qué no hay solicitudes?"))
    .toBeVisible();
});
