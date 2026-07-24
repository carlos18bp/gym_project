import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installLegalRequestsApiMocks,
  buildMockLegalRequestSummary,
  buildMockLegalRequestDetail,
  buildMockUser,
} from "../helpers/legalRequestsMocks.js";
import { mockApi } from "../helpers/api.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

/**
 * Extended mock that provides multiple requests with different statuses
 * for testing filter/management scenarios.
 */
async function installExtendedLegalRequestsMocks(page, { userId, role, requests, details }) {
  const user = buildMockUser({ id: userId, role });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };

    // Requests list — applies the status/search filters the UI sends so a
    // filter interaction produces an observable change in the grid.
    if (apiPath === "legal_requests/") {
      const query = new URL(route.request().url()).searchParams;
      const statusFilter = query.get("status") || "";
      const search = (query.get("search") || "").toLowerCase();

      const filtered = requests.filter((request) => {
        const matchesStatus = !statusFilter || request.status === statusFilter;
        const haystack = [
          request.request_number,
          request.description,
          request.first_name,
          request.last_name,
        ]
          .join(" ")
          .toLowerCase();
        return matchesStatus && (!search || haystack.includes(search));
      });

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requests: filtered,
          count: filtered.length,
          user_role: role,
        }),
      };
    }

    // Request detail by ID
    if (apiPath.match(/^legal_requests\/\d+\/$/)) {
      const reqId = Number(apiPath.match(/legal_requests\/(\d+)\//)[1]);
      const detail = details.find((d) => d.id === reqId);
      if (detail) return { status: 200, contentType: "application/json", body: JSON.stringify(detail) };
    }

    // Create response
    if (apiPath.match(/^legal_requests\/\d+\/responses\/$/) && route.request().method() === "POST") {
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          response: { id: 9001, request: 1001, response_text: "Respuesta de prueba", created_at: nowIso },
        }),
      };
    }

    // Dropdown options
    if (apiPath === "dropdown_options_legal_request/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          legal_request_types: [{ id: 1, name: "Consulta" }, { id: 2, name: "Tutela" }],
          legal_disciplines: [{ id: 1, name: "Civil" }, { id: 2, name: "Laboral" }],
        }),
      };
    }

    // Activity
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };

    return null;
  });
}

test("lawyer filters the list down to the pending requests", { tag: ['@flow:legal-management-lawyer', '@module:legal-requests', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 6100;
  const nowIso = new Date().toISOString();

  const requests = [
    buildMockLegalRequestSummary({ id: 2001, requestNumber: "REQ-2001", status: "PENDING", firstName: "Ana", lastName: "García", email: "ana@test.com", requestTypeName: "Consulta", disciplineName: "Civil", description: "Consulta civil urgente" }),
    buildMockLegalRequestSummary({ id: 2002, requestNumber: "REQ-2002", status: "RESOLVED", firstName: "Carlos", lastName: "Lopez", email: "carlos@test.com", requestTypeName: "Tutela", disciplineName: "Laboral", description: "Tutela laboral resuelta", responseCount: 2 }),
    buildMockLegalRequestSummary({ id: 2003, requestNumber: "REQ-2003", status: "PENDING", firstName: "Maria", lastName: "Torres", email: "maria@test.com", requestTypeName: "Consulta", disciplineName: "Civil", description: "Otra consulta pendiente" }),
  ];

  const details = requests.map((r) =>
    buildMockLegalRequestDetail({ id: r.id, userId, requestNumber: r.request_number, status: r.status, firstName: r.first_name, lastName: r.last_name, email: r.email, requestTypeName: r.request_type_name, disciplineName: r.discipline_name, description: r.description })
  );

  await installExtendedLegalRequestsMocks(page, { userId, role: "lawyer", requests, details });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/legal_requests");

  // All three requests are listed before filtering
  await expect(page.getByText("REQ-2001")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("REQ-2002")).toBeVisible();
  await expect(page.getByText("REQ-2003")).toBeVisible();

  // quality: allow-fragile-selector (the status dropdown is the only select in this view)
  await page.locator("select").first().selectOption("PENDING");

  // The RESOLVED request drops out; the two PENDING ones stay
  await expect(page.getByText("REQ-2002")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Carlos Lopez" })).toHaveCount(0);
  await expect(page.getByText("REQ-2001")).toBeVisible();
  await expect(page.getByText("REQ-2003")).toBeVisible();
});

test("lawyer opens a legal request detail from the list", { tag: ['@flow:legal-management-lawyer', '@module:legal-requests', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 6101;

  const requests = [
    buildMockLegalRequestSummary({ id: 3001, requestNumber: "REQ-3001", status: "PENDING", firstName: "Elena", lastName: "Ruiz", email: "elena@test.com", requestTypeName: "Consulta", disciplineName: "Civil", description: "Consulta sobre contrato" }),
  ];

  const details = [
    buildMockLegalRequestDetail({ id: 3001, userId, requestNumber: "REQ-3001", status: "PENDING", firstName: "Elena", lastName: "Ruiz", email: "elena@test.com", requestTypeName: "Consulta", disciplineName: "Civil", description: "Consulta sobre contrato", responses: [] }),
  ];

  await installExtendedLegalRequestsMocks(page, { userId, role: "lawyer", requests, details });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/legal_requests");

  await expect(page.getByText("REQ-3001")).toBeVisible({ timeout: 15_000 });

  // Click on the request card's "Ver detalles" button
  await page.getByRole("button", { name: /Ver detalles/i }).click();

  // Should navigate to detail page and show request info
  await expect(page.getByText("Consulta sobre contrato")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Solicitud de Elena Ruiz")).toBeVisible();
});

test("client opens their request from the list and reads the lawyer response", { tag: ['@flow:legal-management-lawyer', '@module:legal-requests', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 6102;

  const requests = [
    buildMockLegalRequestSummary({ id: 4001, requestNumber: "REQ-4001", status: "PENDING", firstName: "Client", lastName: "User", email: "client@test.com", requestTypeName: "Consulta", disciplineName: "Laboral", description: "Mi consulta laboral" }),
  ];

  const details = [
    buildMockLegalRequestDetail({
      id: 4001,
      userId,
      requestNumber: "REQ-4001",
      status: "PENDING",
      firstName: "Client",
      lastName: "User",
      email: "client@test.com",
      requestTypeName: "Consulta",
      disciplineName: "Laboral",
      description: "Mi consulta laboral",
      responses: [{ id: 5001, response_text: "Respuesta del abogado", created_at: new Date().toISOString() }],
    }),
  ];

  await installExtendedLegalRequestsMocks(page, { userId, role: "client", requests, details });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/legal_requests");

  await expect(page.getByText("REQ-4001")).toBeVisible({ timeout: 15_000 });
  // The conversation lives on the detail page only
  await expect(page.getByText("Respuesta del abogado")).toHaveCount(0);

  await page.getByRole("button", { name: /Ver detalles/i }).click();

  await expect(page).toHaveURL(/\/legal_request_detail\/4001$/, { timeout: 10_000 });
  await expect(page.getByText("Mi consulta laboral")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Respuesta del abogado")).toBeVisible({ timeout: 10_000 });
});

test("lawyer narrows the list with the search bar and the results summary follows", { tag: ['@flow:legal-management-lawyer', '@module:legal-requests', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 6103;

  const requests = [
    buildMockLegalRequestSummary({ id: 5001, requestNumber: "REQ-5001", status: "PENDING", firstName: "Juan", lastName: "Perez", email: "juan@test.com", requestTypeName: "Tutela", disciplineName: "Civil", description: "Tutela civil" }),
    buildMockLegalRequestSummary({ id: 5002, requestNumber: "REQ-5002", status: "RESOLVED", firstName: "Pedro", lastName: "Gomez", email: "pedro@test.com", requestTypeName: "Consulta", disciplineName: "Laboral", description: "Consulta laboral", responseCount: 1 }),
  ];

  const details = requests.map((r) =>
    buildMockLegalRequestDetail({ id: r.id, userId, requestNumber: r.request_number, status: r.status, firstName: r.first_name, lastName: r.last_name, email: r.email, requestTypeName: r.request_type_name, disciplineName: r.discipline_name, description: r.description })
  );

  await installExtendedLegalRequestsMocks(page, { userId, role: "lawyer", requests, details });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/legal_requests");

  // Both requests visible, summary counts both
  await expect(page.getByText("REQ-5001")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("REQ-5002")).toBeVisible();
  await expect(page.getByText("Mostrando 2 de 2 solicitudes")).toBeVisible();

  await page.getByRole("searchbox", { name: "Buscar" }).fill("Pedro");

  // Only Pedro's request survives the search and the summary recounts
  await expect(page.getByText("REQ-5001")).toHaveCount(0);
  await expect(page.getByText("REQ-5002")).toBeVisible();
  await expect(page.getByText("Mostrando 1 de 1 solicitudes")).toBeVisible();
});
