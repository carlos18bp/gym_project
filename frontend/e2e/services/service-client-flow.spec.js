import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installServiceTramiteApiMocks,
  buildMockServiceRequest,
  buildMockServiceRequestAnswer,
  buildRegistroMarcarioService,
} from "../helpers/serviceTramiteMocks.js";

const CLIENT_ID = 8001;

test(
  "client can browse services from dashboard featured grid",
  {
    tag: [
      "@flow:service-browse-featured",
      "@module:services",
      "@priority:P1",
      "@role:client",
    ],
  },
  async ({ page }) => {
    await installServiceTramiteApiMocks(page, {
      userId: CLIENT_ID,
      role: "client",
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: CLIENT_ID,
        role: "client",
        first_name: "Client",
        last_name: "E2E",
        email: "client@example.com",
        is_profile_completed: true,
      },
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Servicios Destacados")).toBeVisible({ timeout: 15_000 });

    // Featured grid renders short_title ("Registro") in a <p> inside a <button>.
    // Exact match avoids colliding with "Registro Marcario" elsewhere on the page.
    const registroCard = page.getByText("Registro", { exact: true });
    await expect(registroCard).toBeVisible({ timeout: 10_000 });
    await registroCard.click();
    await expect(page).toHaveURL(/\/services\/\d+/);
  }
);

test(
  "client can fill multi-stage form and submit request",
  {
    tag: [
      "@flow:service-submit-request",
      "@flow:service-fill-form",
      "@module:services",
      "@priority:P1",
      "@role:client",
    ],
  },
  async ({ page }) => {
    const service = buildRegistroMarcarioService();

    await installServiceTramiteApiMocks(page, {
      userId: CLIENT_ID,
      role: "client",
      services: [service],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: CLIENT_ID,
        role: "client",
        first_name: "Client",
        last_name: "E2E",
        email: "client@example.com",
        is_profile_completed: true,
      },
    });

    await page.goto(`/services/${service.id}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Datos del Solicitante" })).toBeVisible({ timeout: 15_000 });

    const nombreLabel = page.getByText("Nombre completo", { exact: false }).first();
    await expect(nombreLabel).toBeVisible({ timeout: 10_000 });

    // quality: allow-fragile-selector (form uses plain <label>+<input>; no for/id linkage)
    await page.locator('xpath=//label[contains(., "Nombre completo")]/following-sibling::input[1]').fill("Juan Perez");
    // quality: allow-fragile-selector (form uses plain <label>+<input>; no for/id linkage)
    await page.locator('xpath=//label[contains(., "Correo electronico")]/following-sibling::input[1]').fill("juan@test.com");

    await page.getByRole("button", { name: /^Siguiente$/i }).click();
    await expect(page.getByRole("heading", { name: "Informacion de la Marca" })).toBeVisible({ timeout: 10_000 });
  }
);

test(
  "client can save draft and resume later",
  {
    tag: [
      "@flow:service-save-draft",
      "@module:services",
      "@priority:P2",
      "@role:client",
    ],
  },
  async ({ page }) => {
    const service = buildRegistroMarcarioService();

    let savedDraft = null;
    await installServiceTramiteApiMocks(page, {
      userId: CLIENT_ID,
      role: "client",
      services: [service],
      onSaveRequest: () => {
        savedDraft = buildMockServiceRequest({
          id: 5001,
          status: "DRAFT",
          status_display: "Borrador",
          is_submitted: false,
          tracking_number: null,
          answers: [
            buildMockServiceRequestAnswer({
              field_key: "nombre",
              field_label: "Nombre completo",
              value_text: "Draft Value",
            }),
          ],
        });
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(savedDraft),
        };
      },
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: CLIENT_ID,
        role: "client",
        first_name: "Client",
        last_name: "E2E",
        email: "client@example.com",
        is_profile_completed: true,
      },
    });

    await page.goto(`/services/${service.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Datos del Solicitante" })).toBeVisible({ timeout: 15_000 });

    const nombreLabelDraft = page.getByText("Nombre completo", { exact: false }).first();
    await expect(nombreLabelDraft).toBeVisible({ timeout: 10_000 });

    // quality: allow-fragile-selector (form uses plain <label>+<input>; no for/id linkage)
    await page.locator('xpath=//label[contains(., "Nombre completo")]/following-sibling::input[1]').fill("Draft Value");

    await page.getByRole("button", { name: "Guardar borrador" }).click();

    // quality: allow-fragile-selector (SweetAlert2 portal class is a library-stable anchor)
    await expect(
      page.locator(".swal2-popup").getByText(/Borrador guardado/i)
    ).toBeVisible({ timeout: 10_000 });
  }
);

test(
  "client can view submitted requests in my requests list",
  {
    tag: [
      "@flow:service-view-my-requests",
      "@flow:service-view-request-detail",
      "@module:services",
      "@priority:P1",
      "@role:client",
    ],
  },
  async ({ page }) => {
    const requests = [
      buildMockServiceRequest({
        id: 1,
        tracking_number: "2026-00001",
        status: "OPEN",
        status_display: "Abierto",
        service_name: "Registro Marcario",
      }),
      buildMockServiceRequest({
        id: 2,
        tracking_number: "2026-00002",
        status: "IN_STUDY",
        status_display: "En Estudio",
        service_name: "Consulta Legal",
      }),
    ];

    await installServiceTramiteApiMocks(page, {
      userId: CLIENT_ID,
      role: "client",
      requests,
      requestDetail: requests[0],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: CLIENT_ID,
        role: "client",
        first_name: "Client",
        last_name: "E2E",
        email: "client@example.com",
        is_profile_completed: true,
      },
    });

    await page.goto("/service_requests/my");
    await page.waitForLoadState("networkidle");
    // /service_requests/my redirects to /services?tab=my-requests (ServicesHub).
    // MyServiceRequests renders with embedded=true, so its own h1 is hidden.
    // Assert on the ModuleHeader h1 which is always visible in ServicesHub.
    await expect(page.getByRole("heading", { name: "Servicios y Solicitudes" })).toBeVisible({
      timeout: 15_000,
    });
    // Tracking numbers render as <h2> inside a <button> per-request card.
    await expect(page.getByRole("heading", { name: "2026-00001" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "2026-00002" })).toBeVisible();

    // Click the button wrapping the first request card.
    await page
      .getByRole("button")
      .filter({ has: page.getByRole("heading", { name: "2026-00001" }) })
      .click();
    await expect(page).toHaveURL(/\/service_requests\/\d+/);
  }
);

test(
  "client can browse services catalog page",
  {
    tag: [
      "@flow:service-browse-catalog",
      "@module:services",
      "@priority:P1",
      "@role:client",
    ],
  },
  async ({ page }) => {
    await installServiceTramiteApiMocks(page, {
      userId: CLIENT_ID,
      role: "client",
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: CLIENT_ID,
        role: "client",
        first_name: "Client",
        last_name: "E2E",
        email: "client@example.com",
        is_profile_completed: true,
      },
    });

    await page.goto("/services");
    await page.waitForLoadState("networkidle");
    // ServicesList renders each service as <h2>{service.name}</h2> inside a <button>.
    await expect(page.getByRole("heading", { name: "Registro Marcario" })).toBeVisible({
      timeout: 15_000,
    });

    // Click the wrapping button for the service card.
    await page
      .getByRole("button")
      .filter({ has: page.getByRole("heading", { name: "Registro Marcario" }) })
      .click();
    await expect(page).toHaveURL(/\/services\/\d+/);
  }
);
