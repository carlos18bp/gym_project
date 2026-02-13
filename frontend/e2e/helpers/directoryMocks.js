import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role,
  firstName,
  lastName,
  email,
  identification = "",
} = {}) {
  return {
    id,
    first_name: firstName,
    last_name: lastName,
    email,
    role,
    contact: "",
    birthday: "",
    identification,
    document_type: "",
    photo_profile: "",
    created_at: new Date().toISOString(),
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
    has_signature: true,
  };
}

export function buildMockProcess({ id, lawyerId, clientId } = {}) {
  return {
    id,
    plaintiff: "Demandante",
    defendant: "Demandado",
    authority: "Autoridad",
    ref: "RAD-1",
    subcase: "Caso",
    progress: 10,
    case: { id: 1, type: "Civil" },
    lawyer: { id: lawyerId },
    client: { id: clientId },
    clients: [{ id: clientId }],
    stages: [{ status: "Inicio" }],
    files: [],
  };
}

export async function installDirectoryApiMocks(page, { currentUserId, users, processes = [] }) {
  const me = users.find((u) => u.id === currentUserId);
  if (!me) {
    throw new Error("installDirectoryApiMocks: current user must be included in users array");
  }

  await mockApi(page, async ({ apiPath }) => {
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
        body: JSON.stringify(users),
      };
    }

    if (apiPath === `users/${currentUserId}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(me),
      };
    }

    if (apiPath === `users/${currentUserId}/signature/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_signature: true }),
      };
    }

    if (apiPath === "processes/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(processes),
      };
    }

    // Dashboard misc
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
