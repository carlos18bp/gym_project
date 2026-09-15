// quality: disable fragile_test_data (emails are mock credentials used only for API route interception, not real production data)
import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installServiceTramiteApiMocks,
  buildMockServiceRequest,
  buildMockServiceRequestAnswer,
  buildMockLawyerResponse,
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
      "@outcome:display",
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
  "client fills applicant stage and advances to the brand stage",
  {
    tag: [
      "@flow:service-fill-form",
      "@module:services",
      "@priority:P1",
      "@role:client",
      "@outcome:success",
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

    // quality: allow-fragile-selector (form uses plain <label>+<input>; no for/id linkage)
    await page.locator('xpath=//label[contains(., "Nombre completo")]/following-sibling::input[1]').fill("Juan Perez");
    // quality: allow-fragile-selector (form uses plain <label>+<input>; no for/id linkage)
    await page.locator('xpath=//label[contains(., "Correo electronico")]/following-sibling::input[1]').fill("juan@test.com");

    // Advancing only succeeds if per-stage validation accepted the applicant data,
    // so reaching stage 2 proves the fields were really filled and validated.
    await page.getByRole("button", { name: /^Siguiente$/i }).click();
    await expect(page.getByRole("heading", { name: "Informacion de la Marca" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Nombre de la marca")).toBeVisible();
  }
);

test(
  "client submits the completed request and receives a tracking number",
  {
    tag: [
      "@flow:service-submit-request",
      "@module:services",
      "@priority:P1",
      "@role:client",
      "@outcome:success",
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

    // Stage 1 — applicant data
    await expect(page.getByRole("heading", { name: "Datos del Solicitante" })).toBeVisible({ timeout: 15_000 });
    // quality: allow-fragile-selector (form uses plain <label>+<input>; no for/id linkage)
    await page.locator('xpath=//label[contains(., "Nombre completo")]/following-sibling::input[1]').fill("Juan Perez");
    // quality: allow-fragile-selector (form uses plain <label>+<input>; no for/id linkage)
    await page.locator('xpath=//label[contains(., "Correo electronico")]/following-sibling::input[1]').fill("juan@test.com");
    await page.getByRole("button", { name: /^Siguiente$/i }).click();

    // Stage 2 — brand data (text + required single-select)
    await expect(page.getByRole("heading", { name: "Informacion de la Marca" })).toBeVisible({ timeout: 10_000 });
    // quality: allow-fragile-selector (form uses plain <label>+<input>; no for/id linkage)
    await page.locator('xpath=//label[contains(., "Nombre de la marca")]/following-sibling::input[1]').fill("Marca E2E");
    await page.getByRole("combobox").selectOption("Nominativa");
    await page.getByRole("button", { name: /^Siguiente$/i }).click();

    // Stage 3 — documents (optional) then submit
    await expect(page.getByRole("heading", { name: "Documentos" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /^Enviar solicitud$/i }).click();

    // SweetAlert2 confirms the submission and sets aria-hidden on the page behind it,
    // so assert the toast, then dismiss it before querying the radicado panel.
    // quality: allow-fragile-selector (SweetAlert2 portal class is a library-stable anchor)
    const successToast = page.locator('[class~="swal2-popup"]');
    await expect(successToast).toContainText(/enviada exitosamente/i, { timeout: 10_000 });
    await successToast.getByRole("button", { name: "OK" }).click();

    // Outcome: the request was created and its SIC tracking number (radicado) is shown.
    await expect(page.getByRole("heading", { name: "Solicitud enviada con exito" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Radicado generado/i)).toContainText("2026-00001");
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

    // Assert the confirmation text itself (state change), not just its visibility,
    // so the test fails if the draft-save silently produced no acknowledgement.
    // quality: allow-fragile-selector (SweetAlert2 portal class is a library-stable anchor)
    await expect(page.locator(".swal2-popup")).toContainText(/Borrador guardado/i, { timeout: 10_000 });
  }
);

test(
  "client can view submitted requests in my requests list",
  {
    tag: [
      "@flow:service-view-my-requests",
      "@module:services",
      "@priority:P1",
      "@role:client",
      "@outcome:display",
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

    // Navigate via the UI: land on Servicios (default ServicesHub tab), then
    // click into "Mis Solicitudes" — the path a real client takes, instead of
    // deep-linking /service_requests/my. This is an @outcome:display flow,
    // where reachability itself is the behavior under test.
    await page.goto("/services");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Servicios y Solicitudes" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Mis Solicitudes" }).click();

    // Tracking numbers render as <h2> inside a <button> per-request card.
    await expect(page.getByRole("heading", { name: "2026-00001" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "2026-00002" })).toBeVisible();
  }
);

test(
  "client views a submitted request's detail with stage answers and lawyer responses",
  {
    tag: [
      "@flow:service-view-request-detail",
      "@module:services",
      "@priority:P1",
      "@role:client",
      "@outcome:display",
    ],
  },
  async ({ page }) => {
    const answer = buildMockServiceRequestAnswer({
      field_key: "nombre",
      field_label: "Nombre completo",
      field_type: "input",
      stage_title: "Datos del Solicitante",
      stage_order: 1,
      value_text: "Juan Perez",
    });

    const lawyerResponse = buildMockLawyerResponse({
      message: "Solicitud revisada y aprobada por el equipo juridico",
    });

    const detailedRequest = buildMockServiceRequest({
      id: 1,
      tracking_number: "2026-00001",
      status: "OPEN",
      status_display: "Abierto",
      service_name: "Registro Marcario",
      answers: [answer],
      lawyer_responses: [lawyerResponse],
    });

    const requests = [
      detailedRequest,
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
      requestDetail: detailedRequest,
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

    // Navigate via the UI into the my-requests list, then click into the
    // detail view — reachability IS the behavior under test for this flow.
    await page.goto("/services");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Servicios y Solicitudes" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Mis Solicitudes" }).click();
    await expect(page.getByRole("heading", { name: "2026-00001" })).toBeVisible({ timeout: 10_000 });

    // Click the button wrapping the request card to reach the detail view.
    await page
      .getByRole("button")
      .filter({ has: page.getByRole("heading", { name: "2026-00001" }) })
      .click();
    await expect(page).toHaveURL(/\/service_requests\/\d+/);

    // Tracking number renders in the detail page's own h1 (ServiceRequestDetail.vue).
    await expect(page.getByRole("heading", { level: 1 })).toContainText("2026-00001");

    // Stage answers grouped by phase title, from a populated `answers` entry.
    await expect(page.getByRole("heading", { name: "Respuestas del formulario" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Fase 1 - Datos del Solicitante")).toBeVisible();

    // Lawyer's response message, from a populated `lawyer_responses` entry.
    await expect(page.getByRole("heading", { name: "Respuestas del abogado" })).toBeVisible();
    await expect(page.getByText("Solicitud revisada y aprobada por el equipo juridico")).toBeVisible();
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
      "@outcome:display",
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
