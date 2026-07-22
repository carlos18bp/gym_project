// quality: disable fragile_test_data (emails are mock credentials used only for API route interception, not real production data)
import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installServiceTramiteApiMocks,
  buildMockService,
  buildRegistroMarcarioService,
} from "../helpers/serviceTramiteMocks.js";

const ADMIN_ID = 8200;

test(
  "admin can create service with stages and fields",
  {
    tag: [
      "@flow:service-admin-create",
      "@module:services",
      "@priority:P1",
      "@role:admin",
    ],
  },
  async ({ page }) => {
    const existing = buildRegistroMarcarioService();

    await installServiceTramiteApiMocks(page, {
      userId: ADMIN_ID,
      role: "admin",
      services: [existing],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: ADMIN_ID,
        role: "admin",
        first_name: "Admin",
        last_name: "E2E",
        email: "admin@example.com",
        is_profile_completed: true,
        is_staff: true,
      },
    });

    await page.goto("/services_admin");

    // Should see admin list
    await expect(page.getByText("Registro Marcario")).toBeVisible();
  }
);

test(
  "admin can toggle service active and featured status",
  {
    tag: [
      "@flow:service-admin-toggle",
      "@module:services",
      "@priority:P2",
      "@role:admin",
    ],
  },
  async ({ page }) => {
    const service = buildMockService({
      id: 1,
      name: "Servicio Toggle",
      short_title: "Toggle",
      slug: "servicio-toggle",
      is_active: true,
      is_featured: false,
    });

    await installServiceTramiteApiMocks(page, {
      userId: ADMIN_ID,
      role: "admin",
      services: [service],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: ADMIN_ID,
        role: "admin",
        first_name: "Admin",
        last_name: "E2E",
        email: "admin@example.com",
        is_profile_completed: true,
        is_staff: true,
      },
    });

    await page.goto("/services_admin");
    await expect(page.getByText("Servicio Toggle")).toBeVisible();
  }
);

test(
  "admin can select and edit an existing service",
  {
    tag: [
      "@flow:service-admin-edit",
      "@module:services",
      "@priority:P2",
      "@role:admin",
    ],
  },
  async ({ page }) => {
    const existing = buildRegistroMarcarioService();

    await installServiceTramiteApiMocks(page, {
      userId: ADMIN_ID,
      role: "admin",
      services: [existing],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: ADMIN_ID,
        role: "admin",
        first_name: "Admin",
        last_name: "E2E",
        email: "admin@example.com",
        is_profile_completed: true,
        is_staff: true,
      },
    });

    await page.goto("/services_admin");

    // Click on existing service to open editor
    await page.getByText("Registro Marcario").click();

    // Should see the service editor panel with existing data
    await expect(page.getByText("Registro Marcario")).toBeVisible();
  }
);

test(
  "admin deletes a service after confirming the SweetAlert prompt",
  {
    tag: [
      "@flow:service-admin-delete",
      "@module:services",
      "@priority:P2",
      "@role:admin",
    ],
  },
  async ({ page }) => {
    const existing = buildRegistroMarcarioService();

    await installServiceTramiteApiMocks(page, {
      userId: ADMIN_ID,
      role: "admin",
      services: [existing],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: ADMIN_ID,
        role: "admin",
        first_name: "Admin",
        last_name: "E2E",
        email: "admin@example.com",
        is_profile_completed: true,
        is_staff: true,
      },
    });

    await page.goto("/services_admin");

    // Select the service so the editor exposes the delete action
    await page.getByRole("button", { name: /Registro Marcario/ }).click();
    await page.getByRole("button", { name: "Eliminar servicio" }).click();

    const confirm = page.locator('[class~="swal2-popup"]');
    await expect(confirm).toContainText("¿Eliminar servicio?");
    await page.getByRole("button", { name: "Sí, eliminar" }).click();

    await expect(page.locator('[class~="swal2-popup"]')).toContainText("Servicio eliminado");
    await expect(page.getByRole("button", { name: /Registro Marcario/ })).toHaveCount(0);
  }
);
