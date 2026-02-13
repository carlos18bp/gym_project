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
  tags = [],
  code,
  createdAt,
  updatedAt,
  content = "",
  variables = [],
  signatures = [],
  requires_signature = false,
  summary_counterpart = "",
  summary_object = "",
  summary_value = "",
  summary_term = "",
  summary_subscription_date = null,
  summary_expiration_date = null,
} = {}) {
  const nowIso = new Date().toISOString();

  return {
    id,
    title,
    state,
    created_by: createdBy,
    assigned_to: assignedTo,
    code: code || `DOC-${id}`,
    tags,
    created_at: createdAt || nowIso,
    updated_at: updatedAt || nowIso,
    content,
    variables,
    signatures,
    requires_signature,
    summary_counterpart,
    summary_object,
    summary_value,
    summary_term,
    summary_subscription_date,
    summary_expiration_date,
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

  await mockApi(page, async ({ apiPath }) => {
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

    // NOTE: mockApi() extracts apiPath from URL.pathname, so query params are NOT included.
    // fetchDocuments() hits `/api/dynamic-documents/?page=...`, which arrives here as `dynamic-documents/`.
    if (apiPath === "dynamic-documents/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(docs),
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
