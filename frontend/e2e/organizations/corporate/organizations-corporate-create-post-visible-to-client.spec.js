import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client creates a pinned post with link and client can see it in public posts", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4600;
  const clientUserId = 4601;

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
  await expect(page.getByText("Posts de la Organización").first()).toBeVisible();

  await page.getByRole("button", { name: "Nuevo Post" }).first().click();
  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toBeVisible();

  await page.locator("input#title").fill("Post Visible Cliente");
  await page.locator("textarea#content").fill("Contenido visible para miembros");

  // Add link section
  await page.getByRole("button", { name: "Agregar enlace" }).click();
  await page.locator("input#link_name").fill("Ver enlace");
  await page.locator("input#link_url").fill("https://example.com");

  await page.locator("input#is_pinned").check();

  await page.getByRole("button", { name: "Crear Post" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Post creado exitosamente");
  await page.locator(".swal2-confirm").click();

  // Ensure the create modal is closed (avoids strict-mode collisions with preview)
  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toHaveCount(0);

  const createdPostCard = page
    .locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6")
    .filter({ hasText: "Post Visible Cliente" })
    .first();
  await expect(createdPostCard).toBeVisible();
  await expect(createdPostCard.getByText("Fijado").first()).toBeVisible();

  // Step 2: switch to client and verify public posts
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

  const postCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "Post Visible Cliente" })
    .first();

  await expect(postCard).toBeVisible();
  await expect(postCard).toContainText("Fijado");

  const link = postCard.getByRole("link", { name: "Ver enlace" }).first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://example.com");
});
