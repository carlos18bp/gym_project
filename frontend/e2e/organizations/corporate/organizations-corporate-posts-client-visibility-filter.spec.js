import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client deactivates a post and client does not see it in public posts", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4610;
  const clientUserId = 4611;

  await installOrganizationsDashboardApiMocks(page, {
    userId: corporateUserId,
    role: "corporate_client",
    startWithOrganizations: true,
    clientUserId,
    startWithClientMemberships: true,
  });

  // Step 1: corporate creates a post
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
  await page.getByRole("button", { name: "Nuevo Post" }).first().click();
  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toBeVisible();

  await page.locator("input#title").fill("Post Oculto Cliente");
  await page.locator("textarea#content").fill("Este post será desactivado");

  await page.getByRole("button", { name: "Crear Post" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Post creado exitosamente");
  await page.locator(".swal2-confirm").click();

  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toHaveCount(0);

  const postCard = page
    .locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6")
    .filter({ hasText: "Post Oculto Cliente" })
    .first();
  await expect(postCard).toBeVisible();
  await expect(postCard.getByText("Activo")).toBeVisible();

  // Step 2: corporate deactivates the post
  await postCard.locator('button:has(svg.h-5.w-5)').click();
  const actionsMenu = postCard.locator("div.absolute.right-0.mt-1.w-48").first();
  await expect(actionsMenu).toBeVisible();
  await expect(actionsMenu.locator('button:has-text("Desactivar")')).toBeVisible();
  await actionsMenu.locator('button:has-text("Desactivar")').click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Post desactivado exitosamente");
  await page.locator(".swal2-confirm").click();

  await expect(postCard.getByText("Inactivo")).toBeVisible();

  // Step 3: switch to client and verify it is not visible
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: clientUserId,
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

  const orgPostsSection = page.locator('div:has(h2:has-text("Anuncios de la Organización"))').first();
  await expect(orgPostsSection).toBeVisible();

  await expect(page.getByText("Post Oculto Cliente")).toHaveCount(0);
  await expect(orgPostsSection.getByText("No hay anuncios disponibles")).toBeVisible();
});
