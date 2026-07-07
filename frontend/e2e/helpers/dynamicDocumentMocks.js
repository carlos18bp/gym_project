import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role,
  hasSignature,
  isProfileCompleted = true,
  isGymLawyer = true,
} = {}) {
  return {
    id,
    first_name: "E2E",
    last_name: role === "lawyer" ? "Lawyer" : "Client",
    email: "e2e@example.com",
    role,
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    is_profile_completed: isProfileCompleted,
    is_gym_lawyer: isGymLawyer,
    has_signature: hasSignature,
  };
}

export function buildMockDocument({
  id,
  title,
  state,
  createdBy,
  assignedTo = null,
  // NOTE: the backend model defaults allow_shared_edit to TRUE for new
  // minutas. The mock defaults to false so each spec opts into the shared
  // scenario explicitly (most fixtures model minutas whose creator turned
  // sharing off, which is the restrictive — and assert-heavy — case).
  allowSharedEdit = false,
  tags = [],
  code,
  createdAt,
  updatedAt,
  content = "",
  variables = [],
  signatures = [],
  requires_signature = false,
  signature_type = "normal",
  relationships_count = 0,
  summary_counterparty = "",
  summary_object = "",
  summary_value = "",
  summary_term = "",
  summary_subscription_date = null,
  summary_start_date = null,
  summary_end_date = null,
  summary_payment_installments = null,
  payments_summary = null,
} = {}) {
  const nowIso = new Date().toISOString();

  return {
    id,
    title,
    state,
    created_by: createdBy,
    assigned_to: assignedTo,
    allow_shared_edit: allowSharedEdit,
    code: code || `DOC-${id}`,
    tags,
    created_at: createdAt || nowIso,
    updated_at: updatedAt || nowIso,
    content,
    variables,
    signatures,
    requires_signature,
    signature_type,
    relationships_count,
    summary_counterparty,
    summary_object,
    summary_value,
    summary_term,
    summary_subscription_date,
    summary_start_date,
    summary_end_date,
    summary_payment_installments,
    payments_summary,
  };
}

/**
 * Build the payments payload the backend list endpoint returns, from a
 * mutable in-memory plan ({documentId, totalInstallments, records}).
 * Mirrors the backend sequential rules so specs exercise real flows.
 */
function buildPaymentsPayload(plan, role) {
  const byNumber = new Map(plan.records.map((r) => [r.installment_number, r]));
  let acceptedCount = 0;
  let inReview = false;
  let nextUploadable = null;
  let totalAmount = null;

  for (let n = 1; n <= plan.totalInstallments; n++) {
    const record = byNumber.get(n);
    if (record && record.status === "accepted") {
      acceptedCount++;
      if (record.amount != null) {
        totalAmount = (totalAmount || 0) + Number(record.amount);
      }
      continue;
    }
    if (record && record.status === "uploaded") {
      inReview = true;
    } else {
      nextUploadable = n;
    }
    break;
  }

  const slots = [];
  for (let n = 1; n <= plan.totalInstallments; n++) {
    const record = byNumber.get(n) || null;
    slots.push({
      installment_number: n,
      status: record ? record.status : "pending",
      record: record
        ? {
            id: record.id,
            amount: record.amount ?? null,
            notes: record.notes ?? "",
            original_name: record.original_name ?? `cuenta_cobro_${n}.pdf`,
            rejection_reason: record.rejection_reason ?? null,
            uploaded_at: record.uploaded_at ?? new Date().toISOString(),
            uploaded_by_name: record.uploaded_by_name ?? "E2E User",
          }
        : null,
    });
  }

  return {
    document_id: plan.documentId,
    configured: true,
    total_installments: plan.totalInstallments,
    accepted_count: acceptedCount,
    total_amount_accepted: totalAmount != null ? String(totalAmount) : null,
    in_review: inReview,
    next_uploadable: nextUploadable,
    can_review: role === "lawyer",
    can_upload: nextUploadable != null,
    slots,
  };
}

export function buildMockFolder({
  id,
  name,
  colorId = 0,
  documents = [],
  createdAt,
} = {}) {
  const nowIso = new Date().toISOString();

  return {
    id,
    name,
    color_id: colorId,
    documents,
    created_at: createdAt || nowIso,
    document_ids: documents.map((d) => d.id).filter(Boolean),
  };
}

export async function installDynamicDocumentApiMocks(
  page,
  {
    userId,
    role = "lawyer",
    hasSignature = false,
    documents = null,
    folders = null,
    pendingSignaturesCount = 0,
    // Guided tour status: null keeps the generic `{}` fallback, which the
    // useGuidedTour composable treats as "do nothing" — specs that don't
    // care about the tour stay unaffected. Set 'never' | 'recent' | 'stale'
    // to exercise the tour flows.
    tourStatus = null,
    // Contract-execution plan: null disables the payment endpoints. Shape:
    // { documentId, totalInstallments, records: [{installment_number,
    //   status, amount?, notes?, rejection_reason?, ...}] } — the object is
    // MUTATED by upload/accept/reject so multi-step specs see fresh state.
    paymentPlan = null,
  }
) {
  const user = buildMockUser({ id: userId, role, hasSignature });

  const defaultDocuments = [
    buildMockDocument({
      id: 101,
      title: "Minuta A",
      state: "Draft",
      createdBy: userId,
    }),
    buildMockDocument({
      id: 102,
      title: "Minuta B",
      state: "Published",
      createdBy: userId,
    }),
  ];

  const docs = documents || defaultDocuments;

  const defaultFolders = [
    buildMockFolder({
      id: 201,
      name: "Carpeta 1",
      documents: [docs[0]].filter(Boolean),
    }),
    buildMockFolder({
      id: 202,
      name: "Carpeta 2",
      documents: [],
    }),
  ];

  const folderList = folders || defaultFolders;

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([user]),
      };
    }

    if (apiPath === `users/${userId}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(user),
      };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_signature: hasSignature }),
      };
    }

    if (apiPath === "dynamic-documents/pending-signatures-count/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ pending_count: pendingSignaturesCount }),
      };
    }

    // Guided tour progress (query string is stripped by getApiPath)
    if (apiPath === "tour-progress/" && tourStatus) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          module_name: "dynamic_documents",
          status: tourStatus,
          completed_at:
            tourStatus === "never" ? null : new Date().toISOString(),
        }),
      };
    }

    if (apiPath === "tour-progress/complete/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          module_name: "dynamic_documents",
          status: "recent",
          completed_at: new Date().toISOString(),
        }),
      };
    }

    // Contract execution (cuentas de cobro) — stateful in-memory plan
    if (paymentPlan) {
      const base = `dynamic-documents/${paymentPlan.documentId}/payment-records/`;
      const method = route.request().method();
      const json = (payload, status = 200) => ({
        status,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
      // Normalize ids once so accept/reject can address records
      paymentPlan.records.forEach((record) => {
        if (record.id == null) record.id = 300 + record.installment_number;
      });

      if (apiPath === base && method === "GET") {
        return json(buildPaymentsPayload(paymentPlan, role));
      }

      if (apiPath === `${base}upload/` && method === "POST") {
        const current = buildPaymentsPayload(paymentPlan, role);
        if (current.next_uploadable == null) {
          return json(
            { detail: "Hay una cuenta de cobro en revisión; espera la decisión del abogado." },
            409
          );
        }
        const slotNumber = current.next_uploadable;
        const existing = paymentPlan.records.find(
          (record) => record.installment_number === slotNumber
        );
        if (existing) {
          existing.status = "uploaded";
          existing.uploaded_at = new Date().toISOString();
        } else {
          paymentPlan.records.push({
            id: 300 + slotNumber,
            installment_number: slotNumber,
            status: "uploaded",
          });
        }
        return json(buildPaymentsPayload(paymentPlan, role), 201);
      }

      if (apiPath.startsWith(base) && method === "POST") {
        const [recordIdRaw, action] = apiPath.slice(base.length).split("/");
        const record = paymentPlan.records.find(
          (candidate) => candidate.id === Number(recordIdRaw)
        );
        if (record && action === "accept") {
          record.status = "accepted";
          return json(buildPaymentsPayload(paymentPlan, role));
        }
        if (record && action === "reject") {
          const body = route.request().postDataJSON?.() || {};
          record.status = "rejected";
          record.rejection_reason = body.rejection_reason || "";
          return json(buildPaymentsPayload(paymentPlan, role));
        }
      }

      if (apiPath.startsWith(base) && apiPath.endsWith("/download/") && method === "GET") {
        return {
          status: 200,
          contentType: "application/pdf",
          body: "%PDF-1.4 e2e cuenta de cobro stub",
        };
      }
    }

    // Document list endpoint — supports query-param filtering and paginated response format.
    // fetchDocumentsForTab() sends params like state, states, unassigned, user_related, page, limit.
    if (apiPath === "dynamic-documents/") {
      const url = new URL(route.request().url());
      const params = url.searchParams;
      let filtered = [...docs];

      const stateParam = params.get("state");
      const statesParam = params.get("states");
      const unassigned = params.get("unassigned") === "true";

      if (statesParam) {
        const statesList = statesParam.split(",").map((s) => s.trim());
        filtered = filtered.filter((d) => statesList.includes(d.state));
      } else if (stateParam) {
        filtered = filtered.filter((d) => d.state === stateParam);
      }

      if (unassigned) {
        filtered = filtered.filter((d) => !d.assigned_to);
      }

      // Server-side search: filter by title (mirrors backend icontains on title)
      const searchParam = (params.get("search") || "").trim().toLowerCase();
      if (searchParam) {
        filtered = filtered.filter((d) =>
          (d.title || "").toLowerCase().includes(searchParam)
        );
      }

      // Server-side tag filter
      const tagIdParam = params.get("tag_id");
      if (tagIdParam) {
        const tid = Number(tagIdParam);
        filtered = filtered.filter((d) =>
          Array.isArray(d.tags) && d.tags.some((t) => t.id === tid)
        );
      }

      // Server-side creator filter (mirrors backend `created_by_id=lawyer_id`),
      // used by the minutas "Mías" scope.
      const lawyerIdParam = params.get("lawyer_id");
      if (lawyerIdParam) {
        const lid = Number(lawyerIdParam);
        filtered = filtered.filter((d) => d.created_by === lid);
      }

      // Server-side shared-edit filter (mirrors backend `allow_shared_edit=True`),
      // used by the minutas "Compartidas" scope.
      const sharedParam = (params.get("shared") || "").toLowerCase();
      if (sharedParam === "true" || sharedParam === "1") {
        filtered = filtered.filter((d) => d.allow_shared_edit === true);
      }

      // Server-side sort
      const sortByParam = params.get("sort_by") || "recent";
      if (sortByParam === "name-asc") {
        filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      } else if (sortByParam === "name-desc") {
        filtered.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
      } else if (sortByParam === "oldest") {
        filtered.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
      } else {
        filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      }

      const page = parseInt(params.get("page") || "1", 10);
      const limit = parseInt(params.get("limit") || "10", 10);
      const start = (page - 1) * limit;
      // Mirror the production list serializer, which omits `content` for
      // performance. Consumers that need content must hit the detail endpoint
      // (regression guard for fix 1.3).
      const paged = filtered.slice(start, start + limit).map(({ content, ...rest }) => rest);

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: paged,
          totalItems: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
          currentPage: page,
        }),
      };
    }

    if (apiPath === "dynamic-documents/folders/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(folderList),
      };
    }

    if (apiPath.startsWith("dynamic-documents/folders/") && apiPath.endsWith("/")) {
      const maybeId = apiPath.replace(/^dynamic-documents\/folders\//, "").replace(/\/$/, "");
      const folderId = Number(maybeId);
      const folder = folderList.find((f) => f.id === folderId);
      if (folder) {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(folder),
        };
      }
    }

    // Folder create
    if (apiPath === "dynamic-documents/folders/create/" && route.request().method() === "POST") {
      const body = route.request().postDataJSON?.() || {};
      const newFolder = buildMockFolder({
        id: 900 + folderList.length,
        name: body.name || "New Folder",
        colorId: body.color_id || 0,
      });
      folderList.push(newFolder);
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newFolder),
      };
    }

    // Folder update (also used by "Add to folder" — SelectFolderModal delegates
    // addDocumentsToFolder → updateFolder → PATCH folders/<id>/update/ with document_ids).
    const folderUpdateMatch = apiPath.match(/^dynamic-documents\/folders\/(\d+)\/update\/$/);
    if (folderUpdateMatch && route.request().method() === "PATCH") {
      const folderId = Number(folderUpdateMatch[1]);
      const folder = folderList.find((f) => f.id === folderId);
      if (folder) {
        const body = route.request().postDataJSON?.() || {};
        if (Array.isArray(body.document_ids)) {
          folder.document_ids = body.document_ids;
          folder.documents = body.document_ids
            .map((docId) => docs.find((d) => d.id === docId))
            .filter(Boolean);
        }
        if (typeof body.name === "string") folder.name = body.name;
        if (typeof body.color_id === "number") folder.color_id = body.color_id;
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(folder),
        };
      }
      return {
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Folder not found" }),
      };
    }

    // Tags
    if (apiPath === "dynamic-documents/tags/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    // Permissions
    if (apiPath === "dynamic-documents/permissions/clients/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ clients: [] }),
      };
    }

    if (apiPath === "dynamic-documents/permissions/roles/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    // Document detail
    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = docs.find((d) => d.id === docId);
      if (doc) {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(doc),
        };
      }
    }

    // Document permissions
    if (apiPath.match(/^dynamic-documents\/\d+\/permissions\/$/)) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_public: false,
          visibility_user_ids: [],
          usability_user_ids: [],
          visibility_roles: [],
          usability_roles: [],
        }),
      };
    }

    // Global letterhead (image)
    if (apiPath === "user/letterhead/") {
      return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    }
    if (apiPath === "user/letterhead/upload/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok", warnings: [] }) };
    }
    if (apiPath === "user/letterhead/delete/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ message: "deleted" }) };
    }

    // Global letterhead (Word template)
    if (apiPath === "user/letterhead/word-template/") {
      return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    }
    if (apiPath === "user/letterhead/word-template/upload/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok", template_info: { name: "template.docx", size: 1024 } }) };
    }
    if (apiPath === "user/letterhead/word-template/delete/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ message: "deleted" }) };
    }

    // Document-specific letterhead
    if (apiPath.match(/^dynamic-documents\/\d+\/letterhead\/$/)) {
      return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/letterhead\/upload\/$/)) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ message: "ok", warnings: [] }) };
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/letterhead\/delete\/$/)) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ message: "deleted" }) };
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/letterhead\/word-template\/$/)) {
      return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    }

    // Activity & misc
    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "create-activity/") {
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: new Date().toISOString() }),
      };
    }
    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    return null;
  });
}

/**
 * Install API mocks for formalize/correct document flows.
 * Includes formalize and correct endpoint handlers, paginated document list,
 * document detail/update, permissions, relationships, signatures, and misc.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} options
 * @param {number} options.userId - Lawyer user ID
 * @param {Array} options.documents - Array of mock documents (from buildMockDocument)
 * @param {Function|null} [options.formalizeHandler] - Custom handler for POST /formalize/
 * @param {Function|null} [options.correctHandler] - Custom handler for POST /correct/
 */
export async function installFormalizeMocks(
  page,
  { userId, documents, formalizeHandler = null, correctHandler = null }
) {
  const lawyer = buildMockUser({ id: userId, role: "lawyer", hasSignature: true });
  const client = buildMockUser({ id: userId + 1, role: "client", hasSignature: false, isGymLawyer: false });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    const method = route.request().method();

    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([lawyer, client]) };
    }

    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(lawyer) };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: true }) };
    }

    // Formalize endpoint
    if (apiPath.match(/^dynamic-documents\/\d+\/formalize\/$/) && method === "POST") {
      if (formalizeHandler) {
        return formalizeHandler(route);
      }
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/formalize\/$/)[1]);
      const doc = documents.find((d) => d.id === docId);
      if (doc) {
        const updated = { ...doc, state: "PendingSignatures", requires_signature: true, fully_signed: false };
        return { status: 200, contentType: "application/json", body: JSON.stringify(updated) };
      }
      return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) };
    }

    // Correct endpoint
    if (apiPath.match(/^dynamic-documents\/\d+\/correct\/$/) && method === "POST") {
      if (correctHandler) {
        return correctHandler(route);
      }
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/correct\/$/)[1]);
      const doc = documents.find((d) => d.id === docId);
      if (doc) {
        const updated = { ...doc, state: "PendingSignatures", fully_signed: false };
        return { status: 200, contentType: "application/json", body: JSON.stringify(updated) };
      }
      return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) };
    }

    // Document list (paginated)
    if (apiPath === "dynamic-documents/" && method === "GET") {
      const url = new URL(route.request().url());
      const params = url.searchParams;
      let filtered = [...documents];

      const stateParam = params.get("state");
      const statesParam = params.get("states");

      if (statesParam) {
        const statesList = statesParam.split(",").map((s) => s.trim());
        filtered = filtered.filter((d) => statesList.includes(d.state));
      } else if (stateParam) {
        filtered = filtered.filter((d) => d.state === stateParam);
      }

      const pg = parseInt(params.get("page") || "1", 10);
      const limit = parseInt(params.get("limit") || "10", 10);
      const start = (pg - 1) * limit;
      const paged = filtered.slice(start, start + limit);

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: paged,
          totalItems: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
          currentPage: pg,
        }),
      };
    }

    // Document detail
    if (apiPath.match(/^dynamic-documents\/\d+\/$/) && method === "GET") {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const doc = documents.find((d) => d.id === docId);
      if (doc) {
        return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
      }
    }

    // Document update
    if (apiPath.match(/^dynamic-documents\/\d+\/update\/$/) && method === "PUT") {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/update\/$/)[1]);
      const doc = documents.find((d) => d.id === docId);
      if (doc) {
        return { status: 200, contentType: "application/json", body: JSON.stringify(doc) };
      }
    }

    // Document permissions
    if (apiPath.match(/^dynamic-documents\/\d+\/permissions\/$/)) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ is_public: false, visibility_user_ids: [], usability_user_ids: [], visibility_roles: [], usability_roles: [] }),
      };
    }

    // Relationships
    if (apiPath.match(/^dynamic-documents\/\d+\/relationships\/$/)) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath.match(/^dynamic-documents\/\d+\/relationships\/create\/$/)) {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1 }) };
    }

    // Pending/signed/archived docs
    if (apiPath.match(/pending-documents-full/)) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath.match(/signed-documents/)) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath.match(/archived-documents/)) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath.match(/pending-signatures/)) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    // Tags, folders, letterheads
    if (apiPath === "dynamic-documents/tags/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "dynamic-documents/folders/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath.match(/letterhead/)) {
      return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    }

    // Activity & misc
    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "create-activity/") {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }) };
    }
    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}
