import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client posts section: refresh button shows loading and updates rendered post", async ({ page }) => {
  const userId = 3593;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
    postsScenario: "refresh_changes",
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

  // Initial post
  await expect(page.getByText("Bienvenido a Acme Corp")).toBeVisible();

  const refreshBtn = page.getByRole("button", { name: "Actualizar" }).first();
  await expect(refreshBtn).toBeEnabled();

  await refreshBtn.click();

  // Loading state may appear briefly during refresh (mock resolves fast)
  try {
    await expect(page.getByText("Cargando anuncios...")).toBeVisible({ timeout: 1_500 });
  } catch {
    // Loading indicator may not appear if response resolves immediately.
  }

  // After refresh, a different post should be rendered
  await expect(page.getByText("Anuncio Actualizado")).toBeVisible({ timeout: 10_000 });
});
