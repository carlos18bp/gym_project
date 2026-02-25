import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

// quality: allow-test-too-long (complex cross-role E2E flow requiring extensive setup and validation)

async function closeSuccessDialog(page, expectedText) {
  const successDialog = page.getByRole("dialog");
  await expect(successDialog).toBeVisible({ timeout: 15_000 });
  await expect(successDialog).toContainText(expectedText);
  await successDialog.getByRole("button").click();
}

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
    await page.getByRole("button", { name: "Nuevo Post" }).click();
    await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toBeVisible();

    await page.locator("input#title").fill(title);
    await page.locator("textarea#content").fill(content);

    await page.getByRole("button", { name: "Crear Post" }).click();

    await closeSuccessDialog(page, "Post creado exitosamente");

    await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toHaveCount(0);
  };

  await createPost({ title: "Post B (viejo)", content: "Contenido B" });
  await createPost({ title: "Post A (nuevo)", content: "Contenido A" });

  const postCardA = page
    .locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6")
    .filter({ hasText: "Post A (nuevo)" });

  const postCardB = page
    .locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6")
    .filter({ hasText: "Post B (viejo)" });

  await expect(postCardA).toBeVisible();
  await expect(postCardB).toBeVisible();

  // Step 2: pin the older post (B)
  await postCardB.locator('button:has(svg.h-5.w-5)').click();
  const actionsMenu = postCardB.locator("div.absolute.right-0.mt-1.w-48");
  await expect(actionsMenu).toBeVisible();
  await expect(actionsMenu.locator('button:has-text("Fijar")')).toBeVisible();
  await actionsMenu.locator('button:has-text("Fijar")').click();

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

  // OrganizationPostsSection root: div > div.mb-6 > div.flex > div > h2
  // We need the root div that contains both the header and the posts list
  const orgPostsSection = page
    .getByRole("heading", { name: "Anuncios de la Organización" })
    .locator("xpath=ancestor::div[4]");
  await expect(orgPostsSection).toBeVisible();

  const postCards = orgPostsSection
    .locator("div.bg-white.shadow.rounded-lg.border")
    .filter({ hasText: /Post (A|B)/ });

  await expect(postCards).toHaveCount(2);

  const orderedPostCards = await postCards.all();
  await expect(orderedPostCards[0]).toContainText("Post B (viejo)");
  await expect(orderedPostCards[0]).toContainText("Fijado");
  await expect(orderedPostCards[1]).toContainText("Post A (nuevo)");
});
