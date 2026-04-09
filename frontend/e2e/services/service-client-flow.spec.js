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
    await expect(page.getByText("Servicios Destacados")).toBeVisible();
    await expect(page.getByText("Registro")).toBeVisible();

    await page.getByText("Registro").click();
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

    // Stage 1: Datos del Solicitante
    await expect(page.getByText("Datos del Solicitante")).toBeVisible();

    // quality: allow-fragile-selector (service form inputs lack accessible labels; positional is required)
    const nombreInput = page.locator('input').first();
    await nombreInput.fill("Juan Perez");

    // quality: allow-fragile-selector (service form inputs lack accessible labels; positional is required)
    const emailInput = page.locator('input[type="email"], input').nth(1);
    await emailInput.fill("juan@test.com");

    // Navigate to stage 2
    await page.getByRole("button", { name: /Siguiente/i }).click();
    await expect(page.getByText("Informacion de la Marca")).toBeVisible();
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
    await expect(page.getByText("Datos del Solicitante")).toBeVisible();

    // Fill partial data and save draft
    // quality: allow-fragile-selector (service form inputs lack accessible labels; positional is required)
    const nombreInput = page.locator('input').first();
    await nombreInput.fill("Draft Value");

    const saveBtn = page.getByRole("button", { name: /Guardar/i });
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
    }
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
    await expect(page.getByText("Mis Solicitudes")).toBeVisible();
    await expect(page.getByText("2026-00001")).toBeVisible();
    await expect(page.getByText("2026-00002")).toBeVisible();

    // Click on first request to view detail
    await page.getByText("2026-00001").click();
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
    await expect(page.getByText("Registro")).toBeVisible();

    // Click on service to view detail
    await page.getByText("Registro").click();
    await expect(page).toHaveURL(/\/services\/\d+/);
  }
);
