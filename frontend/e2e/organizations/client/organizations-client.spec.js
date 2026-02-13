import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client can accept an organization invitation and see membership + posts", async ({ page }) => {
  const userId = 3100;

  await installOrganizationsClientApiMocks(page, { userId, role: "client" });

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

  await page.locator('nav[aria-label="Tabs"] button:has-text("Invitaciones")').click();
  await expect(page.getByRole("heading", { name: "Invitaciones Recibidas" })).toBeVisible();

  const invitationCard = page.locator('div:has(h3:has-text("Acme Corp"))').first();
  await expect(invitationCard.getByRole("button", { name: "Aceptar" })).toBeVisible();
  await invitationCard.getByRole("button", { name: "Aceptar" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Invitación aceptada exitosamente");
  await page.locator(".swal2-confirm").click();

  await page.locator('nav[aria-label="Tabs"] button:has-text("Mis Organizaciones")').click();

  await expect(page.getByText("Anuncios de Organizaciones")).toBeVisible();
  await expect(page.locator('h3:has-text("Acme Corp")').first()).toBeVisible();
  await expect(page.getByText("Bienvenido a Acme Corp")).toBeVisible();
  await expect(page.getByText("Fijado")).toBeVisible();
});
