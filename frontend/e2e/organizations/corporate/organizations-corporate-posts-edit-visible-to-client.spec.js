import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

// quality: allow-test-too-long (complex cross-role E2E flow requiring extensive setup and validation)

// quality: allow-too-many-assertions (complex cross-role E2E flow with multiple checkpoints)

async function closeSuccessDialog(page, expectedText) {
  const successDialog = page.getByRole("dialog");
  await expect(successDialog).toBeVisible({ timeout: 15_000 });
  await expect(successDialog).toContainText(expectedText);
  await page.getByRole("button", { name: /^(OK|Aceptar)$/i }).click();
}

test("corporate_client edits a post and client sees updated title/content/link", { tag: ['@flow:org-posts-visibility', '@module:organizations', '@priority:P2', '@role:corporate'] }, async ({ page }) => {
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
  const newPostButton = page.getByRole("button", { name: "Nuevo Post", exact: true });
  await expect(newPostButton).toBeVisible({ timeout: 15_000 });

  await newPostButton.click();
  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toBeVisible();

  await page.locator("input#title").fill("Post A Editar");
  await page.locator("textarea#content").fill("Contenido inicial");

  await page.getByRole("button", { name: "Crear Post" }).click();
  await closeSuccessDialog(page, "Post creado exitosamente");

  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toHaveCount(0);

  const postCard = page.locator(
    "xpath=//h3[normalize-space()='Post A Editar']/ancestor::div[contains(@class,'bg-white') and contains(@class,'rounded-lg')][1]"
  );
  await expect(postCard).toBeVisible();

  // Step 2: corporate edits the post
  await postCard.locator("button:has(svg.h-5.w-5)").click();
  const actionsMenu = postCard.locator(
    "xpath=.//div[contains(@class,'absolute') and contains(@class,'right-0') and contains(@class,'w-48')]"
  );
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
  await closeSuccessDialog(page, "Post actualizado exitosamente");

  await expect(page.getByRole("heading", { name: "Editar Post" })).toHaveCount(0);

  // Post should reflect updated content
  await expect(page.getByText("Post Editado", { exact: true })).toBeVisible();
  await expect(page.getByText("Contenido actualizado")).toBeVisible();
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

  await expect(page.getByRole("heading", { name: "Post Editado" })).toBeVisible();
  await expect(page.getByText("Contenido actualizado")).toBeVisible();

  const publicPostCard = page.locator(
    "xpath=//h3[normalize-space()='Post Editado']/ancestor::div[contains(@class,'bg-white') and contains(@class,'rounded-lg')][1]"
  );
  const link = publicPostCard.getByRole("link", { name: "Ver documento" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://example.com/doc");

  await expect(page.getByText("Post A Editar")).toHaveCount(0);
});
