import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role,
  isProfileCompleted = true,
  isGymLawyer = role === "lawyer",
  hasSignature = false,
} = {}) {
  return {
    id,
    first_name: "E2E",
    last_name: role === "lawyer" ? "Lawyer" : "Client",
    email: role === "lawyer" ? "lawyer@example.com" : "client@example.com",
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

export function buildMockSignedDocument({
  id,
  title,
  createdBy,
  tags = [],
  signatures = [],
  relationshipsCount = 0,
} = {}) {
  const nowIso = new Date().toISOString();

  return {
    id,
    title,
    state: "FullySigned",
    created_by: createdBy,
    assigned_to: null,
    code: `DOC-${id}`,
    tags,
    created_at: nowIso,
    updated_at: nowIso,
    content: "",
    variables: [],
    signatures,
    relationships_count: relationshipsCount,
  };
}

export async function installSignedDocumentsApiMocks(
  page,
  { userId, role = "lawyer", documents = [] }
) {
  const me = buildMockUser({ id: userId, role, hasSignature: true });

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([me]),
      };
    }

    if (apiPath === `users/${userId}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(me),
      };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_signature: true }),
      };
    }

    // The store fetches /api/dynamic-documents/?page=... which arrives here as apiPath === 'dynamic-documents/'
    if (apiPath === "dynamic-documents/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(documents),
      };
    }

    // Fallback endpoints used if store computed lists are empty
    if (apiPath.startsWith("dynamic-documents/created-by/") && apiPath.endsWith("/pending-signatures/")) {
      return {
        status: 200,
        contentType: "application/json",
        body: "[]",
      };
    }

    if (apiPath.startsWith("dynamic-documents/user/") && apiPath.endsWith("/pending-documents-full/")) {
      return {
        status: 200,
        contentType: "application/json",
        body: "[]",
      };
    }

    // Keep noise down if any dashboard widgets run
    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "create-activity/") {
      const now = new Date().toISOString();
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: now }),
      };
    }

    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}
