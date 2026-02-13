import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsClientApiMocks } from "../../helpers/organizationsClientMocks.js";

test("client create request modal: submit disabled until form valid", async ({ page }) => {
  const userId = 3580;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
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

  // Open modal
  await page.getByRole("button", { name: "Nueva Solicitud" }).first().click();
  await expect(page.getByText("Nueva Solicitud Corporativa")).toBeVisible();

  const dialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: "Nueva Solicitud Corporativa" });

  const submitBtn = dialog.getByRole("button", { name: "Enviar Solicitud" }).first();

  // Initially disabled
  await expect(submitBtn).toBeDisabled();

  // Fill partially
  await dialog.locator("select#organization").selectOption("1");
  await expect(submitBtn).toBeDisabled();

  await dialog.locator("select#request_type").selectOption("1");
  await expect(submitBtn).toBeDisabled();

  await dialog.locator("#title").fill("Título E2E");
  await expect(submitBtn).toBeDisabled();

  await dialog.locator("#description").fill("Descripción E2E");
  await expect(submitBtn).toBeEnabled();
});

test("client create request modal: shows validation errors on 400 and stays open", async ({ page }) => {
  const userId = 3581;

  await installOrganizationsClientApiMocks(page, {
    userId,
    role: "client",
    startWithMemberships: true,
    includeInvitation: false,
    createRequestScenario: "validation_error",
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

  // Open modal
  await page.getByRole("button", { name: "Nueva Solicitud" }).first().click();

  await expect(page.getByText("Nueva Solicitud Corporativa")).toBeVisible();

  const dialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: "Nueva Solicitud Corporativa" });

  await dialog.locator("select#organization").selectOption("1");
  await dialog.locator("select#request_type").selectOption("1");
  await dialog.locator("#title").fill("Título que falla");
  await dialog.locator("#description").fill("Descripción E2E");

  const submitBtn = dialog.getByRole("button", { name: "Enviar Solicitud" }).first();
  await expect(submitBtn).toBeEnabled();

  await submitBtn.click();

  // Modal should remain open and show field-level error
  await expect(page.getByText("Nueva Solicitud Corporativa")).toBeVisible();
  await expect(page.getByText("¡Solicitud Enviada!")).toHaveCount(0);
  await expect(page.getByText("Título inválido")).toBeVisible();
});
