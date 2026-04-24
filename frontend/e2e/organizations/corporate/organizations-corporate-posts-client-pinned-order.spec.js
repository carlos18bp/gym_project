import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";
import {
  closeSuccessDialog,
  getCorporatePostCardByTitle,
  openCorporatePostActions,
} from "../../helpers/organizationPosts.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

// quality: allow-test-too-long (complex cross-role E2E flow requiring extensive setup and validation)

test("corporate_client pins an older post and client sees pinned posts first", { tag: ['@flow:org-posts-visibility', '@module:organizations', '@priority:P2', '@role:corporate'] }, async ({ page }) => {
  test.setTimeout(60_000);

  const corporateUserId = 4620;
  const clientUserId = 4621;

  await installOrganizationsDashboardApiMocks(page, {
    userId: corporateUserId,
    role: "corporate_client",
    startWithOrganizations: true,
    clientUserId,
    startWithClientMemberships: true,
  });

  // Step 1: corporate creates two posts (B first, then A)
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
  await page.waitForLoadState("networkidle");
  await expect(page.locator('h1:has-text("Panel Corporativo")')).toBeVisible();

  const createPost = async ({ title, content }) => {
    await page.getByTestId("corporate-new-post-1").click();
    await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toBeVisible();

    await page.locator("input#title").fill(title);
    await page.locator("textarea#content").fill(content);

    await page.getByRole("button", { name: "Crear Post" }).click();

    await closeSuccessDialog(page, "Post creado exitosamente");

    await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toHaveCount(0);
  };

  await createPost({ title: "Post B (viejo)", content: "Contenido B" });
  await createPost({ title: "Post A (nuevo)", content: "Contenido A" });

  const postCardA = getCorporatePostCardByTitle(page, "Post A (nuevo)");
  const postCardB = getCorporatePostCardByTitle(page, "Post B (viejo)");

  await expect(postCardA).toBeVisible();
  await expect(postCardB).toBeVisible();

  const actionsMenu = await openCorporatePostActions(postCardB);
  await actionsMenu.locator('[data-testid^="corporate-post-toggle-pin-"]').click();

  await closeSuccessDialog(page, "Post fijado exitosamente");

  // Step 3: switch to client and verify pinned post is first
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

  const postCards = orgPostsSection.locator('[data-testid^="client-post-card-"]');

  await expect(postCards).toHaveCount(2);
  await expect(postCards.nth(0)).toContainText("Post B (viejo)"); // quality: allow-fragile-selector (nth() needed for pinned-order sequence test)
  await expect(postCards.nth(0)).toContainText("Fijado"); // quality: allow-fragile-selector (nth() needed for pinned-order sequence test)
  await expect(postCards.nth(1)).toContainText("Post A (nuevo)"); // quality: allow-fragile-selector (nth() needed for pinned-order sequence test)
});
