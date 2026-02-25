import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

test("client without memberships: 'Nueva Solicitud' button is disabled and does not open modal", { tag: ['@flow:org-client-requests', '@module:organizations', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 3540;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: false,
    includeInvitation: false,
    myRequestsScenario: "forbidden",
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
  await expect(page.getByText("No perteneces a ninguna organización")).toBeVisible();

  const newRequestButton = page.getByRole("button", { name: "Nueva Solicitud" }).first();
  await expect(newRequestButton).toBeDisabled();
  await expect(newRequestButton).toHaveAttribute(
    "title",
    "Debes ser miembro de una organización para crear solicitudes"
  );

  // It should not open the modal
  await newRequestButton.click({ force: true });
  await expect(page.getByText("Nueva Solicitud Corporativa")).toHaveCount(0);
});
