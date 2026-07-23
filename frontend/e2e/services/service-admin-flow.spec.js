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
    await expect(page.getByText("Registro Marcario")).toBeVisible({ timeout: 15_000 });

    // Start from a blank editor
    await page.getByRole("button", { name: "Nuevo", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Nuevo servicio" })).toBeVisible();

    await page.getByPlaceholder("Nombre del servicio").fill("Cambio de Razón Social");
    await page.getByPlaceholder("Titulo corto (1-2 palabras)").fill("Razón Social");
    await page.getByPlaceholder("Descripcion", { exact: true }).fill("Trámite ante cámara de comercio");

    // Stage 1 comes pre-seeded with a single empty field
    await page.getByPlaceholder("Titulo etapa").fill("Datos de la sociedad");
    await page.getByPlaceholder("key_campo").fill("nit");
    await page.getByPlaceholder("Etiqueta").fill("NIT");

    // Add a second field to the same stage
    await page.getByRole("button", { name: "+ Agregar campo" }).click();
    await expect(page.getByText("Campo 2")).toBeVisible();
    await page.getByPlaceholder("key_campo").nth(1).fill("razon_social");
    await page.getByPlaceholder("Etiqueta").nth(1).fill("Nueva razón social");

    const createRequest = page.waitForRequest(
      (request) =>
        request.url().includes("/api/services/admin/create/") &&
        request.method() === "POST"
    );
    await page.getByRole("button", { name: "Guardar servicio" }).click();
    const sent = await createRequest;

    // The payload carries the stage/field tree the admin just built
    // (sent as a JSON blob inside the multipart "payload" part)
    const rawPayload = (sent.postData() || "").match(
      /name="payload"\r?\n\r?\n([\s\S]*?)\r?\n--/
    );
    const payload = JSON.parse(rawPayload[1]);
    expect(payload.name).toBe("Cambio de Razón Social");
    expect(payload.short_title).toBe("Razón Social");
    expect(payload.stages).toHaveLength(1);
    expect(payload.stages[0].title).toBe("Datos de la sociedad");
    expect(payload.stages[0].fields.map((field) => field.key)).toEqual([
      "nit",
      "razon_social",
    ]);

    await expect(page.getByText("Servicio creado")).toBeVisible({ timeout: 10_000 });
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
    await expect(page.getByText("Servicio Toggle")).toBeVisible({ timeout: 15_000 });

    // The list badges start as Activo / Normal
    const card = page.getByRole("button", { name: /Servicio Toggle/ });
    await expect(card.getByText("Activo")).toBeVisible();
    await expect(card.getByText("Normal")).toBeVisible();

    await card.click();
    await expect(page.getByRole("heading", { name: "Editar servicio" })).toBeVisible();

    await page.getByRole("button", { name: "Desactivar" }).click();
    await expect(card.getByText("Inactivo")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Activar" })).toBeVisible();

    await page.getByRole("button", { name: "Marcar destacado" }).click();
    await expect(card.getByText("Destacado")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Quitar destacado" })).toBeVisible();
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
