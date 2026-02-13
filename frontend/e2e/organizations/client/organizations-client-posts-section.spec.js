import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client posts section: renders pinned post and link", async ({ page }) => {
  const userId = 3590;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
    postsScenario: "with_link",
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

  // Post card contents
  const postCard = page
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: "Bienvenido a Acme Corp" })
    .first();

  await expect(postCard).toBeVisible();
  await expect(postCard).toContainText("Fijado");
  await expect(postCard).toContainText("Anuncio Destacado");

  const link = postCard.getByRole("link", { name: "Ver enlace" }).first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://example.com");
});

test("client posts section: empty state when organization has no posts", async ({ page }) => {
  const userId = 3591;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
    postsScenario: "empty",
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

  await expect(page.locator('h2:has-text("Anuncios de Organizaciones")')).toBeVisible();
  await expect(page.getByText("No hay anuncios disponibles")).toBeVisible();
  await expect(
    page.getByText(
      "La organización aún no ha publicado ningún anuncio. Los anuncios importantes aparecerán aquí."
    )
  ).toBeVisible();
});

test("client posts section: access denied friendly empty state when 403", async ({ page }) => {
  const userId = 3592;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
    postsScenario: "forbidden",
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

  await expect(page.locator('h2:has-text("Anuncios de Organizaciones")')).toBeVisible();
  await expect(page.getByText("No tienes acceso a estos anuncios")).toBeVisible();
  await expect(
    page.getByText(
      "Para ver los anuncios de una organización, primero debes ser miembro activo de ella. Acepta una invitación o solicita unirte a una organización."
    )
  ).toBeVisible();
  await expect(page.getByText("¿Cómo acceder?")).toBeVisible();
});
