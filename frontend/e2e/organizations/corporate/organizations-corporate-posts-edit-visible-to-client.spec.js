import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

test("corporate_client edits a post and client sees updated title/content/link", async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4960;
  const clientUserId = 4961;

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

  await page.locator("input#title").fill("Post A Editar");
  await page.locator("textarea#content").fill("Contenido inicial");

  await page.getByRole("button", { name: "Crear Post" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Post creado exitosamente");
  await page.locator(".swal2-confirm").click();

  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toHaveCount(0);

  const postCard = page
    .locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6")
    .filter({ hasText: "Post A Editar" })
    .first();
  await expect(postCard).toBeVisible();

  // Step 2: corporate edits the post
  await postCard.locator('button:has(svg.h-5.w-5)').click();
  const actionsMenu = postCard.locator("div.absolute.right-0.mt-1.w-48").first();
  await expect(actionsMenu).toBeVisible();
  await actionsMenu.locator('button:has-text("Editar")').click();

  await expect(page.getByRole("heading", { name: "Editar Post" })).toBeVisible();

  // Update title/content
  await page.locator("input#title").fill("Post Editado");
  await page.locator("textarea#content").fill("Contenido actualizado");

  // Add link
  await page.getByRole("button", { name: "Agregar enlace" }).click();
  await page.locator("input#link_name").fill("Ver documento");
  await page.locator("input#link_url").fill("https://example.com/doc");

  await page.getByRole("button", { name: "Actualizar Post" }).click();

  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("Post actualizado exitosamente");
  await page.locator(".swal2-confirm").click();

  await expect(page.getByRole("heading", { name: "Editar Post" })).toHaveCount(0);

  // Post card should be updated
  const updatedPostCard = page
    .locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6")
    .filter({ hasText: "Post Editado" })
    .first();
  await expect(updatedPostCard).toBeVisible();
  await expect(page.getByText("Post A Editar")).toHaveCount(0);

  // Step 3: client sees updated post in public posts
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

  const publicPostCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "Post Editado" })
    .first();

  await expect(publicPostCard).toBeVisible();
  await expect(publicPostCard).toContainText("Contenido actualizado");

  const link = publicPostCard.getByRole("link", { name: "Ver documento" }).first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://example.com/doc");

  await expect(page.getByText("Post A Editar")).toHaveCount(0);
});
