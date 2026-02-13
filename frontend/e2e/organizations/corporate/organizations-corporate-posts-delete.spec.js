import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client deletes a post and client no longer sees it", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4950;
  const clientUserId = 4951;

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

  await page.locator("input#title").fill("Post A Eliminar");
  await page.locator("textarea#content").fill("Este post será eliminado");

  await page.getByRole("button", { name: "Crear Post" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Post creado exitosamente");
  await page.locator(".swal2-confirm").click();

  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toHaveCount(0);

  const corporatePostCard = page
    .locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6")
    .filter({ hasText: "Post A Eliminar" })
    .first();
  await expect(corporatePostCard).toBeVisible();

  // Step 2: client sees the post
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

  const orgPostsSection = page
    .locator('div:has(h2:has-text("Anuncios de la Organización"))')
    .first();
  await expect(orgPostsSection).toBeVisible();

  await expect(orgPostsSection.getByText("Post A Eliminar")).toBeVisible();

  // Step 3: corporate deletes the post
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

  const corporatePostCardToDelete = page
    .locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6")
    .filter({ hasText: "Post A Eliminar" })
    .first();
  await expect(corporatePostCardToDelete).toBeVisible();

  await corporatePostCardToDelete.locator('button:has(svg.h-5.w-5)').click();
  const actionsMenu = corporatePostCardToDelete.locator("div.absolute.right-0.mt-1.w-48").first();
  await expect(actionsMenu).toBeVisible();
  await actionsMenu.locator('button:has-text("Eliminar")').click();

  // Confirmation modal
  await expect(
    page.getByRole("heading", { name: "¿Eliminar post 'Post A Eliminar'?" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText(
    'Post "Post A Eliminar" eliminado exitosamente'
  );
  await page.locator(".swal2-confirm").click();

  await expect(
    page.locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6").filter({
      hasText: "Post A Eliminar",
    })
  ).toHaveCount(0);

  // Step 4: client no longer sees the post
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

  const orgPostsSectionAfter = page
    .locator('div:has(h2:has-text("Anuncios de la Organización"))')
    .first();
  await expect(orgPostsSectionAfter).toBeVisible();

  await expect(orgPostsSectionAfter.getByText("Post A Eliminar")).toHaveCount(0);
});
