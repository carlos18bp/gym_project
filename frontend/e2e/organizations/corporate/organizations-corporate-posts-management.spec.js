import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

async function assertSuccessDialog(page, expectedText) {
  const successDialog = page.getByRole("dialog");
  await expect(successDialog).toBeVisible({ timeout: 15_000 });
  await expect(successDialog).toContainText(expectedText);
  await successDialog.getByRole("button").click();
}

test("corporate_client can create, pin/unpin, toggle status, edit and delete an organization post", async ({ page }) => {
  test.setTimeout(60_000);

  const userId = 4100;

  await installOrganizationsDashboardApiMocks(page, { userId, role: "corporate_client" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
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

  // Posts section
  await expect(page.getByRole("heading", { name: "Posts de la Organización" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nuevo Post" })).toBeVisible();

  // Create a post
  await page.getByRole("button", { name: "Nuevo Post" }).click();
  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toBeVisible();

  await page.locator("input#title").fill("Post E2E");
  await page.locator("textarea#content").fill("Contenido E2E");
  await page.locator("input#is_pinned").check();

  await page.getByRole("button", { name: "Crear Post" }).click();

  await assertSuccessDialog(page, "Post creado exitosamente");

  // Card appears
  const postCard = page.locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6", { hasText: "Post E2E" });
  await expect(postCard).toBeVisible();
  await expect(postCard).toContainText("Fijado");
  await expect(postCard.getByText("Activo")).toBeVisible();

  // Open actions menu and unpin
  await postCard.locator('button:has(svg.h-5.w-5)').click();
  const actionsMenu = postCard.locator("div.absolute.right-0.mt-1.w-48");
  await expect(actionsMenu).toBeVisible();
  await expect(actionsMenu.locator('button:has-text("Desfijar")')).toBeVisible();
  await actionsMenu.locator('button:has-text("Desfijar")').click();

  await assertSuccessDialog(page, "Post desfijado exitosamente");
  await expect(postCard.getByText("Fijado")).toHaveCount(0);

  // Toggle status (deactivate)
  await postCard.locator('button:has(svg.h-5.w-5)').click();
  await expect(actionsMenu.locator('button:has-text("Desactivar")')).toBeVisible();
  await actionsMenu.locator('button:has-text("Desactivar")').click();

  await assertSuccessDialog(page, "Post desactivado exitosamente");
  await expect(postCard.getByText("Inactivo")).toBeVisible();

  // Edit post
  await postCard.locator('button:has(svg.h-5.w-5)').click();
  await expect(actionsMenu.locator('button:has-text("Editar")')).toBeVisible();
  await actionsMenu.locator('button:has-text("Editar")').click();

  await expect(page.getByRole("heading", { name: "Editar Post" })).toBeVisible();
  await page.locator("input#title").fill("Post E2E Editado");
  await page.getByRole("button", { name: "Actualizar Post" }).click();

  await assertSuccessDialog(page, "Post actualizado exitosamente");

  const editedCard = page.locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6", { hasText: "Post E2E Editado" });
  await expect(editedCard).toBeVisible();

  // Delete post
  await editedCard.locator('button:has(svg.h-5.w-5)').click();
  const editedMenu = editedCard.locator("div.absolute.right-0.mt-1.w-48");
  await expect(editedMenu).toBeVisible();
  await expect(editedMenu.locator('button:has-text("Eliminar")')).toBeVisible();
  await editedMenu.locator('button:has-text("Eliminar")').click();

  await expect(page.getByRole("heading", { name: "¿Eliminar post 'Post E2E Editado'?" })).toBeVisible();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();

  await assertSuccessDialog(page, 'Post "Post E2E Editado" eliminado exitosamente');

  await expect(
    page.locator("div.bg-white.shadow.rounded-lg.border.border-gray-200.p-6", { hasText: "Post E2E Editado" })
  ).toHaveCount(0);
});
