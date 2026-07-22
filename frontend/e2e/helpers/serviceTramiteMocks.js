import { mockApi } from "./api.js";

// ─── Mock Builders ──────────────────────────────────────────────────────────

export function buildMockUser({
  id,
  role,
  firstName = "E2E",
  lastName = role === "lawyer" ? "Lawyer" : "Client",
  email = "e2e@example.com",
  isProfileCompleted = true,
  isGymLawyer = role === "lawyer",
  isStaff = role === "admin",
} = {}) {
  return {
    id,
    first_name: firstName,
    last_name: lastName,
    email,
    role,
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    created_at: new Date().toISOString(),
    is_profile_completed: isProfileCompleted,
    is_gym_lawyer: isGymLawyer,
    is_staff: isStaff,
    has_signature: false,
  };
}

export function buildMockServiceField({
  id = 1,
  key = "campo_1",
  label = "Campo 1",
  field_type = "input",
  placeholder = "",
  help_text = "",
  is_required = false,
  order = 1,
  options = null,
  allowed_extensions = null,
  allow_multiple_files = false,
  max_files = 1,
} = {}) {
  return {
    id,
    key,
    label,
    field_type,
    placeholder,
    help_text,
    is_required,
    order,
    options,
    allowed_extensions,
    allow_multiple_files,
    max_files,
  };
}

export function buildMockServiceStage({
  id = 1,
  title = "Etapa 1",
  description = "",
  order = 1,
  is_active = true,
  fields = [],
} = {}) {
  return { id, title, description, order, is_active, fields };
}

export function buildMockService({
  id = 1,
  name = "Registro Marcario",
  short_title = "Registro",
  slug = "registro-marcario",
  description = "Servicio de prueba para registro de marca",
  icon_image_url = null,
  is_active = true,
  is_featured = true,
  featured_order = 1,
  stages = [],
} = {}) {
  return {
    id,
    name,
    short_title,
    slug,
    description,
    icon_image_url,
    is_active,
    is_featured,
    featured_order,
    stages,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function buildMockServiceRequestAnswer({
  id = 1,
  field = 1,
  field_key = "campo_1",
  field_label = "Campo 1",
  field_type = "input",
  stage_title = "Etapa 1",
  stage_order = 1,
  value_text = "Valor de prueba",
  value_json = null,
  files = [],
} = {}) {
  return {
    id,
    field,
    field_key,
    field_label,
    field_type,
    stage_title,
    stage_order,
    value_text,
    value_json,
    files,
  };
}

export function buildMockLawyerResponse({
  id = 1,
  responder = 1,
  responder_name = "Abogado E2E",
  message = "Solicitud revisada",
  status_before = "OPEN",
  status_before_display = "Abierto",
  status_after = "IN_STUDY",
  status_after_display = "En Estudio",
  files = [],
  created_at = null,
} = {}) {
  return {
    id,
    responder,
    responder_name,
    message,
    status_before,
    status_before_display,
    status_after,
    status_after_display,
    files,
    created_at: created_at || new Date().toISOString(),
  };
}

export function buildMockServiceRequest({
  id = 1,
  service = null,
  service_name = "Registro Marcario",
  service_short_title = "Registro",
  requester = 1,
  requester_name = "Client E2E",
  status = "OPEN",
  status_display = "Abierto",
  tracking_number = "2026-00001",
  is_submitted = true,
  current_stage = 1,
  legal_note = "Esta solicitud esta sujeta a estudio y revision por parte del abogado asignado",
  submitted_at = null,
  document_url = null,
  answers = [],
  lawyer_responses = [],
} = {}) {
  const nowIso = new Date().toISOString();
  return {
    id,
    service: service || {
      id: 1,
      name: service_name,
      short_title: service_short_title,
      slug: "registro-marcario",
      description: "",
      icon_image_url: null,
      is_active: true,
      is_featured: true,
      featured_order: 1,
    },
    requester,
    requester_name,
    status,
    status_display,
    tracking_number,
    is_submitted,
    current_stage,
    legal_note,
    submitted_at: submitted_at || nowIso,
    created_at: nowIso,
    updated_at: nowIso,
    document_url,
    answers,
    lawyer_responses,
  };
}

// ─── Preset: Registro Marcario Service ──────────────────────────────────────

export function buildRegistroMarcarioService({ id = 1 } = {}) {
  return buildMockService({
    id,
    name: "Registro Marcario",
    short_title: "Registro",
    slug: "registro-marcario",
    description: "Servicio para registro de marca ante la SIC",
    is_active: true,
    is_featured: true,
    featured_order: 1,
    stages: [
      buildMockServiceStage({
        id: 10,
        title: "Datos del Solicitante",
        order: 1,
        fields: [
          buildMockServiceField({ id: 100, key: "nombre", label: "Nombre completo", field_type: "input", is_required: true, order: 1 }),
          buildMockServiceField({ id: 101, key: "email", label: "Correo electronico", field_type: "email", is_required: true, order: 2 }),
        ],
      }),
      buildMockServiceStage({
        id: 11,
        title: "Informacion de la Marca",
        order: 2,
        fields: [
          buildMockServiceField({ id: 102, key: "nombre_marca", label: "Nombre de la marca", field_type: "input", is_required: true, order: 1 }),
          buildMockServiceField({
            id: 103,
            key: "tipo_marca",
            label: "Tipo de marca",
            field_type: "select_single",
            is_required: true,
            order: 2,
            options: ["Nominativa", "Figurativa", "Mixta"],
          }),
        ],
      }),
      buildMockServiceStage({
        id: 12,
        title: "Documentos",
        order: 3,
        fields: [
          buildMockServiceField({
            id: 104,
            key: "logo",
            label: "Logo de la marca",
            field_type: "file",
            is_required: false,
            order: 1,
            allowed_extensions: [".jpg", ".png", ".pdf"],
            allow_multiple_files: false,
            max_files: 1,
          }),
        ],
      }),
    ],
  });
}

// ─── API Mock Installer ─────────────────────────────────────────────────────

export async function installServiceTramiteApiMocks(
  page,
  {
    userId,
    role = "client",
    services = null,
    featuredServices = null,
    requests = [],
    requestDetail = null,
    draftData = null,
    onSaveRequest = null,
    onManageRequest = null,
  }
) {
  const user = buildMockUser({ id: userId, role });
  const nowIso = new Date().toISOString();

  const defaultService = buildRegistroMarcarioService();
  const serviceList = services || [defaultService];
  const featured = featuredServices || serviceList.filter((s) => s.is_featured);

  let currentRequestDetail = requestDetail;
  let currentRequests = [...requests];

  await mockApi(page, async ({ route, apiPath }) => {
    const method = route.request().method();

    // ─── Auth & Common ────────────────────────────────────────
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    }

    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    }

    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "create-activity/") {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }) };
    }

    // ─── Dashboard common endpoints ──────────────────────────
    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    // ─── Services Catalog ─────────────────────────────────────
    if (apiPath === "services/" && method === "GET") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: serviceList.length, services: serviceList }),
      };
    }

    if (apiPath === "services/featured/" && method === "GET") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ services: featured.slice(0, 6) }),
      };
    }

    // Service detail
    const serviceDetailMatch = apiPath.match(/^services\/(\d+)\/$/);
    if (serviceDetailMatch && method === "GET") {
      const svcId = parseInt(serviceDetailMatch[1]);
      const svc = serviceList.find((s) => s.id === svcId) || defaultService;
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ service: svc, draft: draftData }),
      };
    }

    // ─── Admin ────────────────────────────────────────────────
    if (apiPath === "services/admin/list/" && method === "GET") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ services: serviceList }),
      };
    }

    const adminDelete = apiPath.match(/^services\/admin\/(\d+)\/delete\/$/);
    if (adminDelete && method === "DELETE") {
      const id = Number(adminDelete[1]);
      const idx = serviceList.findIndex((s) => s.id === id);
      if (idx !== -1) serviceList.splice(idx, 1);
      return { status: 204, contentType: "application/json", body: "" };
    }

    if (apiPath === "services/admin/create/" && method === "POST") {
      const newService = buildMockService({ id: 999, name: "Nuevo Servicio", short_title: "Nuevo", slug: "nuevo-servicio" });
      return { status: 201, contentType: "application/json", body: JSON.stringify(newService) };
    }

    const toggleActiveMatch = apiPath.match(/^services\/admin\/(\d+)\/toggle-active\/$/);
    if (toggleActiveMatch && method === "POST") {
      const svcId = parseInt(toggleActiveMatch[1]);
      const svc = serviceList.find((s) => s.id === svcId);
      const newActive = svc ? !svc.is_active : false;
      if (svc) svc.is_active = newActive;
      return { status: 200, contentType: "application/json", body: JSON.stringify({ id: svcId, is_active: newActive }) };
    }

    const toggleFeaturedMatch = apiPath.match(/^services\/admin\/(\d+)\/toggle-featured\/$/);
    if (toggleFeaturedMatch && method === "POST") {
      const svcId = parseInt(toggleFeaturedMatch[1]);
      const svc = serviceList.find((s) => s.id === svcId);
      const newFeatured = svc ? !svc.is_featured : false;
      if (svc) svc.is_featured = newFeatured;
      return { status: 200, contentType: "application/json", body: JSON.stringify({ id: svcId, is_featured: newFeatured }) };
    }

    // ─── Service Requests ─────────────────────────────────────
    if (apiPath === "service-requests/save/" && method === "POST") {
      if (onSaveRequest) {
        const result = onSaveRequest(route);
        if (result) return result;
      }
      const saved = buildMockServiceRequest({
        id: 5001,
        tracking_number: "2026-00001",
        status: "OPEN",
        is_submitted: true,
        document_url: "/api/service-requests/5001/document/download/",
      });
      currentRequestDetail = saved;
      return { status: 200, contentType: "application/json", body: JSON.stringify(saved) };
    }

    // Draft
    const draftMatch = apiPath.match(/^service-requests\/service\/(\d+)\/draft\/$/);
    if (draftMatch && method === "GET") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ draft: draftData }) };
    }

    // My requests
    if (apiPath === "service-requests/my/" && method === "GET") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: currentRequests.length, results: currentRequests }),
      };
    }

    // Inbox
    if (apiPath === "service-requests/inbox/" && method === "GET") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: currentRequests.length, results: currentRequests }),
      };
    }

    // Request detail
    const reqDetailMatch = apiPath.match(/^service-requests\/(\d+)\/$/);
    if (reqDetailMatch && method === "GET") {
      const detail = currentRequestDetail || buildMockServiceRequest({ id: parseInt(reqDetailMatch[1]) });
      return { status: 200, contentType: "application/json", body: JSON.stringify(detail) };
    }

    // Manage request
    const manageMatch = apiPath.match(/^service-requests\/(\d+)\/manage\/$/);
    if (manageMatch && method === "POST") {
      if (onManageRequest) {
        const result = onManageRequest(route);
        if (result) return result;
      }
      const managed = currentRequestDetail
        ? { ...currentRequestDetail, status: "IN_STUDY", status_display: "En Estudio" }
        : buildMockServiceRequest({ id: parseInt(manageMatch[1]), status: "IN_STUDY", status_display: "En Estudio" });
      currentRequestDetail = managed;
      return { status: 200, contentType: "application/json", body: JSON.stringify(managed) };
    }

    // Document download
    const docDownloadMatch = apiPath.match(/^service-requests\/(\d+)\/document\/download\/$/);
    if (docDownloadMatch && method === "GET") {
      return { status: 200, contentType: "application/pdf", body: "%PDF-1.4 mock" };
    }

    return null;
  });
}
