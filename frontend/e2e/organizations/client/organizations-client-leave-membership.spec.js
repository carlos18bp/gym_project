import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

test("client can leave an organization and loses access to posts", { tag: ['@flow:org-client-leave', '@module:organizations', '@priority:P3', '@role:client'] }, async ({ page }) => {
  const userId = 3600;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "client",
      is_gym_lawyer: false,
      is_profile_completed: true,
      first_name: "E2E",
      last_name: "Client",
      email: "client@example.com",
    },
  });

  await page.goto("/organizations_dashboard");

  await expect(page.locator('h1:has-text("Mis Organizaciones")')).toBeVisible();
  await expect(page.locator('h3:has-text("Acme Corp")').first()).toBeVisible(); // quality: allow-fragile-selector (positional selector for first matching element)

  // Posts are visible while member
  await expect(page.getByText("Bienvenido a Acme Corp")).toBeVisible();

  // Leave organization (OrganizationCard)
  const organizationCard = page.locator('div:has(h3:has-text("Acme Corp"))').first(); // quality: allow-fragile-selector (positional selector for first matching element)
  await organizationCard.getByRole("button", { name: "Salir" }).click();

  // ConfirmationModal
  await expect(page.getByRole("heading", { name: "¿Salir de Acme Corp?" })).toBeVisible();
  await page.getByRole("button", { name: "Sí, salir" }).click();

  // showNotification uses SweetAlert2 (title is the message)
  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 }); // quality: allow-fragile-selector (class selector targets stable UI structure)
  await expect(page.locator(".swal2-title")).toHaveText("Has abandonado Acme Corp"); // quality: allow-fragile-selector (class selector targets stable UI structure)
  await page.locator(".swal2-confirm").click(); // quality: allow-fragile-selector (class selector targets stable UI structure)

  // Membership removed
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();

  // Posts should not be visible anymore
  await expect(page.getByText("Bienvenido a Acme Corp")).toHaveCount(0);
});
