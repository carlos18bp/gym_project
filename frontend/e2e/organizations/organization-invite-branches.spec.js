// quality: disable fragile_test_data (emails are mock credentials used only for API route interception, not real production data)
import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../helpers/organizationsDashboardMocks.js";

/**
 * Branch coverage tests for org-invite-member flow.
 * Drives the corporate dashboard invite modal, the members modal, and the
 * client-side memberships view.
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

  await page.goto("/organizations_dashboard");
  await expect(page.getByRole("heading", { name: "Panel Corporativo", level: 1 })).toBeVisible({ timeout: 15_000 });

  // Opening the invite modal from the organization card shows the invite form
  await page.getByRole("button", { name: "Invitar Miembro" }).click();
  await expect(page.getByRole("heading", { name: "Invitar Nuevo Miembro" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Email del Cliente")).toBeVisible();
  await expect(page.getByPlaceholder("cliente@ejemplo.com")).toBeVisible();
});

test("corporate user with active organization sees members list", { tag: ['@flow:org-members-list', '@module:organizations', '@priority:P2', '@role:corporate'] }, async ({ page }) => {
  const userId = 9401;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "corporate_client",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "corporate_client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/organizations_dashboard");
  await expect(page.getByRole("heading", { name: "Panel Corporativo", level: 1 })).toBeVisible({ timeout: 15_000 });

  // The org card metric button opens the members modal with the seeded members
  await page.getByRole("button", { name: "2 miembros" }).click();
  await expect(page.getByRole("heading", { name: "Miembros de Acme Corp" })).toBeVisible({ timeout: 10_000 });

  // Scope member names to the modal (they also appear in the requests section)
  const membersModal = page.getByLabel("Miembros de Acme Corp");
  await expect(membersModal.getByText("Client One")).toBeVisible();
  await expect(membersModal.getByText("Client Two")).toBeVisible();
});

test("client user switches from their organizations to their requests tab", { tag: ['@flow:org-client-view', '@module:organizations', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 9402;

  await installOrganizationsDashboardApiMocks(page, {
    userId,
    role: "client",
    clientUserId: userId,
    startWithClientMemberships: true,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/organizations_dashboard");
  await expect(page.getByRole("heading", { name: "Mis Organizaciones", level: 1 })).toBeVisible({ timeout: 15_000 });

  // Starting point: membership content renders (announcements + org card)
  await expect(page.getByRole("heading", { name: "Anuncios de Organizaciones" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acme Corp" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mis Solicitudes Corporativas" })).toHaveCount(0);

  // The requests tab is only enabled because the client belongs to an organization
  await page.getByRole("button", { name: /Mis Solicitudes/ }).first().click();

  // Transition: the requests section replaces the organizations section
  await expect(page.getByRole("heading", { name: "Mis Solicitudes Corporativas" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Salir" })).toHaveCount(0);
});
