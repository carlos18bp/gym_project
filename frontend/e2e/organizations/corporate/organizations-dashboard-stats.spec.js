import { test, expect } from "../../helpers/test.js";
import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

// Each statistics card is a semantic <dl> with a <dt> label and <dd> value
const statCard = (page, label) => page.locator("dl").filter({ hasText: label });

test("corporate client searches received requests from the stats dashboard", { tag: ['@flow:org-corporate-requests', '@module:organizations', '@priority:P2', '@role:corporate'] }, async ({ page }) => {
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
  await expect(page.getByRole("heading", { name: "Panel Corporativo", level: 1 })).toBeVisible({ timeout: 15_000 });

  // Starting point: stats cards reflect the seeded organization (1 org,
  // 2 members, 1 pending invitation, 1 received corporate request)
  await expect(statCard(page, "Organizaciones")).toContainText("1");
  await expect(statCard(page, "Miembros Totales")).toContainText("2");
  await expect(statCard(page, "Invitaciones Pendientes")).toContainText("1");
  await expect(statCard(page, "Total Solicitudes")).toContainText("1");
  await expect(page.getByText("CORP-REQ-5001")).toBeVisible();

  await page.getByPlaceholder("Buscar por título, cliente...").fill("no-existe");

  // Transition: the received requests list empties out for a non-matching search
  await expect(page.getByText("CORP-REQ-5001")).toHaveCount(0);
  await expect(page.getByText("No se encontraron solicitudes")).toBeVisible();

  await page.getByPlaceholder("Buscar por título, cliente...").fill("Client One");

  // Transition: searching by client name brings the request back
  await expect(page.getByText("CORP-REQ-5001")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Panel Corporativo", level: 1 })).toBeVisible({ timeout: 15_000 });

  // Empty state with the create CTA and zeroed stats
  await expect(page.getByText("No tienes organizaciones creadas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear Organización" })).toBeVisible();
  await expect(statCard(page, "Organizaciones")).toContainText("0");
});
