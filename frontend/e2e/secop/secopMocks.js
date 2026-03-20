/**
 * Shared API mock installer for SECOP E2E tests.
 *
 * Intercepts all /api/* routes and returns deterministic fake data
 * so tests run without a live backend.
 */
import { mockApi } from "../helpers/api.js";

const MOCK_PROCESSES = [
  {
    id: 9001,
    process_id: "CO1.REQ.E2E001",
    reference: "SA-E2E-001",
    entity_name: "Ministerio de Transporte",
    department: "Bogotá D.C.",
    status: "Abierto",
    procurement_method: "Licitación pública",
    contract_type: "Obra",
    base_price: "500000000.00",
    description: "Construcción de vía terciaria E2E",
    procedure_name: "Obra vial E2E Bogotá",
    publication_date: "2026-03-01",
    closing_date: "2026-04-30T17:00:00Z",
    is_open: true,
    days_remaining: 42,
    my_classification: null,
    process_url: "https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.REQ.E2E001",
  },
  {
    id: 9002,
    process_id: "CO1.REQ.E2E002",
    reference: "SA-E2E-002",
    entity_name: "INVIAS",
    department: "Antioquia",
    status: "Cerrado",
    procurement_method: "Concurso de méritos",
    contract_type: "Consultoría",
    base_price: "100000000.00",
    description: "Consultoría ambiental E2E",
    procedure_name: "Consultoría ambiental E2E",
    publication_date: "2026-02-01",
    closing_date: "2026-03-10T17:00:00Z",
    is_open: false,
    days_remaining: 0,
    my_classification: null,
    process_url: "https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.REQ.E2E002",
  },
  {
    id: 9003,
    process_id: "CO1.REQ.E2E003",
    reference: "SA-E2E-003",
    entity_name: "Alcaldía de Medellín",
    department: "Antioquia",
    status: "Abierto",
    procurement_method: "Selección abreviada",
    contract_type: "Suministro",
    base_price: "75000000.00",
    description: "Suministro de equipos de cómputo E2E",
    procedure_name: "Suministro equipos E2E",
    publication_date: "2026-03-10",
    closing_date: "2026-05-15T17:00:00Z",
    is_open: true,
    days_remaining: 57,
    my_classification: { id: 1, status: "INTERESTING", notes: "Revisar" },
    process_url: "https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.REQ.E2E003",
  },
];

const MOCK_PROCESS_DETAIL = {
  ...MOCK_PROCESSES[0],
  entity_nit: "899999090-2",
  city: "Bogotá D.C.",
  entity_level: "Nacional",
  phase: "Publicado",
  duration_value: 180,
  duration_unit: "Días",
  unspsc_code: "72141000",
  raw_data: {},
  classifications: [
    {
      id: 1,
      user: { id: 9901, first_name: "E2E", last_name: "Lawyer" },
      status: "INTERESTING",
      notes: "Revisar con equipo",
      is_mine: true,
      created_at: "2026-03-15T10:00:00Z",
      updated_at: "2026-03-15T10:00:00Z",
    },
  ],
};

const MOCK_ALERTS = [
  {
    id: 501,
    name: "Obras Antioquia",
    keywords: "obra, construcción",
    departments: "Antioquia",
    entities: "",
    min_budget: null,
    max_budget: null,
    procurement_methods: "",
    frequency: "DAILY",
    is_active: true,
    notification_count: 3,
    created_at: "2026-03-01T10:00:00Z",
  },
  {
    id: 502,
    name: "Consultoría Nacional",
    keywords: "consultoría",
    departments: "",
    entities: "",
    min_budget: "100000000",
    max_budget: null,
    procurement_methods: "",
    frequency: "IMMEDIATE",
    is_active: true,
    notification_count: 1,
    created_at: "2026-03-05T10:00:00Z",
  },
];

const MOCK_SAVED_VIEWS = [
  {
    id: 701,
    name: "Antioquia Obras",
    filters: { department: "Antioquia", contract_type: "Obra" },
    created_at: "2026-03-10T10:00:00Z",
  },
];

const MOCK_FILTERS = {
  departments: ["Antioquia", "Bogotá D.C.", "Valle del Cauca"],
  procurement_methods: ["Licitación pública", "Concurso de méritos", "Selección abreviada"],
  statuses: ["Abierto", "Cerrado", "Adjudicado"],
  contract_types: ["Obra", "Consultoría", "Suministro"],
};

const MOCK_SYNC_STATUS = {
  last_success: {
    id: 1,
    status: "SUCCESS",
    finished_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    records_processed: 150,
    records_created: 30,
    records_updated: 120,
    duration_seconds: 45.2,
  },
  recent: [],
  total_processes: 150,
};

/**
 * Install all SECOP API route mocks on a Playwright page.
 * Uses the project's mockApi helper for consistent route interception.
 */
export async function installSecopApiMocks(page, overrides = {}) {
  const userId = overrides.userId || 9901;
  const processes = overrides.processes || MOCK_PROCESSES;
  const classified = processes.filter((p) => p.my_classification !== null);

  await mockApi(page, async ({ route, apiPath }) => {
    const method = route.request().method();

    // ── Common routes needed for page load ──
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }
    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }
    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: userId, first_name: "E2E", last_name: "Lawyer", email: "e2e@example.com",
          role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, has_signature: false,
          contact: "", birthday: "", identification: "", document_type: "", photo_profile: "",
          created_at: new Date().toISOString(),
        }]),
      };
    }
    if (apiPath === `users/${userId}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: userId, first_name: "E2E", last_name: "Lawyer", email: "e2e@example.com",
          role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, has_signature: false,
          contact: "", birthday: "", identification: "", document_type: "", photo_profile: "",
          created_at: new Date().toISOString(),
        }),
      };
    }
    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    }
    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "create-activity/") {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1 }) };
    }
    if (apiPath === "user/letterhead/") {
      return { status: 404, contentType: "application/json", body: "{}" };
    }
    if (apiPath === "user/signature/") {
      return { status: 404, contentType: "application/json", body: "{}" };
    }

    // ── SECOP Process routes ──
    if (apiPath === "secop/processes/my-classified/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: classified,
          count: classified.length,
          total_pages: 1,
          current_page: 1,
          page_size: 20,
        }),
      };
    }

    // Process detail: secop/processes/<id>/
    const detailMatch = apiPath.match(/^secop\/processes\/(\d+)\/$/);
    if (detailMatch) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(overrides.processDetail || MOCK_PROCESS_DETAIL),
      };
    }

    // Process list
    if (apiPath === "secop/processes/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: processes,
          count: processes.length,
          total_pages: 1,
          current_page: 1,
          page_size: 20,
        }),
      };
    }

    // ── Classifications ──
    if (apiPath.startsWith("secop/classifications")) {
      if (method === "POST") {
        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ id: 999, status: "INTERESTING", notes: "", process: 9001 }),
        };
      }
      if (method === "DELETE") {
        return { status: 204, contentType: "application/json", body: "" };
      }
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    // ── Alerts ──
    if (apiPath.match(/^secop\/alerts\/\d+\/toggle\/$/)) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_ALERTS[0], is_active: false }),
      };
    }
    if (apiPath.startsWith("secop/alerts")) {
      if (method === "GET") {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(overrides.alerts || MOCK_ALERTS),
        };
      }
      if (method === "POST") {
        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ id: 599, name: "New E2E Alert", is_active: true, frequency: "DAILY", notification_count: 0 }),
        };
      }
      if (method === "PUT") {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...MOCK_ALERTS[0], name: "Updated" }),
        };
      }
      if (method === "DELETE") {
        return { status: 204, contentType: "application/json", body: "" };
      }
    }

    // ── Saved views ──
    if (apiPath.startsWith("secop/saved-views")) {
      if (method === "GET") {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(overrides.savedViews || MOCK_SAVED_VIEWS),
        };
      }
      if (method === "POST") {
        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ id: 799, name: "New E2E View", filters: { department: "Bogotá D.C." } }),
        };
      }
      if (method === "DELETE") {
        return { status: 204, contentType: "application/json", body: "" };
      }
    }

    // ── Filters ──
    if (apiPath === "secop/filters/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FILTERS),
      };
    }

    // ── Sync ──
    if (apiPath === "secop/sync/trigger/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Sync triggered." }),
      };
    }
    if (apiPath === "secop/sync/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SYNC_STATUS),
      };
    }

    // ── Export ──
    if (apiPath === "secop/export/") {
      return {
        status: 200,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: Buffer.from("fake-xlsx-content").toString("base64"),
      };
    }

    // Fallback
    return null;
  });
}

export { MOCK_PROCESSES, MOCK_PROCESS_DETAIL, MOCK_ALERTS, MOCK_SAVED_VIEWS, MOCK_FILTERS, MOCK_SYNC_STATUS };
