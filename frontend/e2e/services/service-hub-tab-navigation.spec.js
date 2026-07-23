// quality: disable fragile_test_data (emails are mock credentials used only for API route interception, not real production data)
import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installServiceTramiteApiMocks,
  buildMockServiceRequest,
} from "../helpers/serviceTramiteMocks.js";

const CLIENT_ID = 8001;

test(
  "client opens the services hub from the sidebar and lands on the catalog tab",
  {
    tag: [
      "@flow:service-hub-tab-navigation",
      "@module:services",
      "@priority:P2",
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
    await page.getByText("Servicios y Solicitudes").first().waitFor({ timeout: 15_000 });

    // The hub is not mounted yet — no tabs, no catalog
    await expect(page.getByRole("button", { name: "Mis Solicitudes" })).toHaveCount(0);

    await page.getByText("Servicios y Solicitudes").first().click();

    await expect(page).toHaveURL(/\/services$/, { timeout: 15_000 });

    // ServicesHub always renders the ModuleHeader title
    await expect(page.getByRole("heading", { name: "Servicios y Solicitudes" })).toBeVisible({
      timeout: 15_000,
    });

    // Default tab shows the service catalog
    await expect(page.getByRole("heading", { name: "Registro Marcario" })).toBeVisible({
      timeout: 10_000,
    });

    // Both tab buttons are rendered
    await expect(page.getByRole("button", { name: "Servicios" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mis Solicitudes" })).toBeVisible();
  }
);

test(
  "client switches to Mis Solicitudes tab and sees requests list",
  {
    tag: [
      "@flow:service-hub-tab-navigation",
      "@module:services",
      "@priority:P2",
      "@role:client",
    ],
  },
  async ({ page }) => {
    const requests = [
      buildMockServiceRequest({
        id: 1,
        tracking_number: "2026-00100",
        status: "OPEN",
        status_display: "Abierto",
        service_name: "Registro Marcario",
      }),
    ];

    await installServiceTramiteApiMocks(page, {
      userId: CLIENT_ID,
      role: "client",
      requests,
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

    // Click the "Mis Solicitudes" tab
    await page.getByRole("button", { name: "Mis Solicitudes" }).click();

    // Request card renders as h2 inside a button
    await expect(page.getByRole("heading", { name: "2026-00100" })).toBeVisible({
      timeout: 10_000,
    });

    // Service catalog content is no longer visible
    await expect(page.getByRole("heading", { name: "Registro Marcario" })).not.toBeVisible();
  }
);

test(
  "legacy URL /service_requests/my redirects to ServicesHub with Mis Solicitudes tab active",
  {
    tag: [
      "@flow:service-hub-tab-navigation",
      "@module:services",
      "@priority:P2",
      "@role:client",
    ],
  },
  async ({ page }) => {
    const requests = [
      buildMockServiceRequest({
        id: 2,
        tracking_number: "2026-00200",
        status: "IN_STUDY",
        status_display: "En Estudio",
        service_name: "Consulta Legal",
      }),
    ];

    await installServiceTramiteApiMocks(page, {
      userId: CLIENT_ID,
      role: "client",
      requests,
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

    // Legacy path triggers a router redirect to /services?tab=my-requests
    await page.goto("/service_requests/my");
    await page.waitForLoadState("networkidle");

    // ServicesHub header is visible (redirect landed on the right page)
    await expect(page.getByRole("heading", { name: "Servicios y Solicitudes" })).toBeVisible({
      timeout: 15_000,
    });

    // The "Mis Solicitudes" tab content is rendered (request card visible)
    await expect(page.getByRole("heading", { name: "2026-00200" })).toBeVisible({
      timeout: 10_000,
    });

    // Service catalog is not shown in this tab
    await expect(page.getByRole("heading", { name: "Registro Marcario" })).not.toBeVisible();
  }
);
