import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client can leave an organization and dashboard updates accordingly", async ({ page }) => {
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
  await expect(page.locator('h2:has-text("Anuncios de Organizaciones")')).toBeVisible();

  const orgCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "Miembro desde" })
    .filter({ hasText: "Acme Corp" })
    .first();

  await expect(orgCard).toBeVisible();

  await orgCard.getByRole("button", { name: "Salir" }).click();

  // ConfirmationModal
  await expect(page.getByText("¿Salir de Acme Corp?")).toBeVisible();
  await expect(
    page.getByText(
      "¿Estás seguro de que quieres abandonar esta organización? Ya no podrás enviar solicitudes a través de ella."
    )
  ).toBeVisible();

  await page.getByRole("button", { name: "Sí, salir" }).click();

  // A notification dialog is shown and makes the dashboard aria-hidden.
  await expect(page.getByRole("dialog").filter({ hasText: "Has abandonado Acme Corp" })).toBeVisible();
  await page.getByRole("button", { name: "OK" }).click();

  // Membership removed -> empty state
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();

  // Posts section should disappear when no memberships
  await expect(page.locator('h2:has-text("Anuncios de Organizaciones")')).toHaveCount(0);

  // Header CTA should be disabled again
  const newRequestButton = page.getByRole("button", { name: "Nueva Solicitud" }).first();
  await expect(newRequestButton).toBeDisabled();
  await expect(newRequestButton).toHaveAttribute(
    "title",
    "Debes ser miembro de una organización para crear solicitudes"
  );

  // Requests tab should be disabled
  const desktopTabs = page.locator('nav[aria-label="Tabs"]');
  const myRequestsTab = desktopTabs.getByRole("button", { name: /Mis Solicitudes/ }).first();
  await expect(myRequestsTab).toBeDisabled();
});
