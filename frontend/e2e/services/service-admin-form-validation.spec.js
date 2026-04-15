import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installServiceTramiteApiMocks,
  buildRegistroMarcarioService,
} from "../helpers/serviceTramiteMocks.js";

const ADMIN_ID = 8200;

async function setupAdminPage(page) {
  await installServiceTramiteApiMocks(page, {
    userId: ADMIN_ID,
    role: "admin",
    services: [buildRegistroMarcarioService()],
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
  await expect(page.getByRole("heading", { name: "Administrar Servicios" })).toBeVisible({
    timeout: 15_000,
  });

  // Click "Nuevo" to open the empty creation form
  await page.getByRole("button", { name: "Nuevo" }).click();
}

test(
  "admin sees validation error when trying to save service without a name",
  {
    tag: [
      "@flow:service-admin-form-validation",
      "@module:services",
      "@priority:P3",
      "@role:admin",
    ],
  },
  async ({ page }) => {
    await setupAdminPage(page);

    // Leave service name empty and click "Guardar servicio"
    await page.getByRole("button", { name: "Guardar servicio" }).click();

    // SweetAlert2 shows the first validation error
    // quality: allow-fragile-selector (SweetAlert2 portal class is a library-stable anchor)
    await expect(
      page.locator(".swal2-popup").getByText(/El nombre del servicio es obligatorio/i)
    ).toBeVisible({ timeout: 5_000 });
  }
);

test(
  "admin sees validation error when trying to save service without stages",
  {
    tag: [
      "@flow:service-admin-form-validation",
      "@module:services",
      "@priority:P3",
      "@role:admin",
    ],
  },
  async ({ page }) => {
    await setupAdminPage(page);

    // Fill name and short title but add no stages
    await page.locator('input[placeholder="Nombre del servicio"]').fill("Servicio Sin Etapas");
    await page.locator('input[placeholder="Titulo corto (1-2 palabras)"]').fill("Sin Etapas");

    await page.getByRole("button", { name: "Guardar servicio" }).click();

    // quality: allow-fragile-selector (SweetAlert2 portal class is a library-stable anchor)
    await expect(
      page.locator(".swal2-popup").getByText(/Debes agregar al menos una etapa/i)
    ).toBeVisible({ timeout: 5_000 });
  }
);
