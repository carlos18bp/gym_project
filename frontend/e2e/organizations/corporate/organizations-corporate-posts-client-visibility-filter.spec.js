import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";
import {
  closeSuccessDialog,
  getCorporatePostCardByTitle,
  openCorporatePostActions,
} from "../../helpers/organizationPosts.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

// quality: allow-too-many-assertions (complex cross-role E2E flow with multiple checkpoints)

test("corporate_client deactivates a post and client does not see it in public posts", { tag: ['@flow:org-posts-visibility', '@module:organizations', '@priority:P2', '@role:corporate'] }, async ({ page }) => {
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
  await page.getByTestId("corporate-new-post-1").click();
  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toBeVisible();

  await page.locator("input#title").fill("Post Oculto Cliente");
  await page.locator("textarea#content").fill("Este post será desactivado");

  await page.getByRole("button", { name: "Crear Post" }).click();

  await closeSuccessDialog(page, "Post creado exitosamente");

  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toHaveCount(0);

  const postCard = getCorporatePostCardByTitle(page, "Post Oculto Cliente");
  await expect(postCard).toBeVisible();
  await expect(postCard.locator('[data-testid^="corporate-post-state-"]')).toContainText("Activo");

  const actionsMenu = await openCorporatePostActions(postCard);
  await actionsMenu.locator('[data-testid^="corporate-post-toggle-status-"]').click();

  await closeSuccessDialog(page, "Post desactivado exitosamente");

  await expect(postCard.locator('[data-testid^="corporate-post-state-"]')).toContainText("Inactivo");

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

  const orgPostsSection = page.getByTestId("organization-posts-section-1");
  await expect(orgPostsSection).toBeVisible();

  await expect(page.getByText("Post Oculto Cliente")).toHaveCount(0);
  await expect(page.getByTestId("organization-posts-empty-title-1")).toContainText("No hay anuncios disponibles");
});
