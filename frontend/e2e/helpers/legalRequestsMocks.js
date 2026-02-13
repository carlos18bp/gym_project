import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role,
  isProfileCompleted = true,
  isGymLawyer = true,
  hasSignature = false,
} = {}) {
  return {
    id,
    first_name: role === "lawyer" ? "E2E" : "Client",
    last_name: role === "lawyer" ? "Lawyer" : "User",
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

export function buildMockLegalRequestSummary({
  id,
  requestNumber,
  status = "PENDING",
  firstName,
  lastName,
  email,
  requestTypeName,
  disciplineName,
  responseCount = 0,
  description,
  createdAt,
} = {}) {
  const nowIso = new Date().toISOString();

  return {
    id,
    request_number: requestNumber,
    status,
    status_display: status,
    first_name: firstName,
    last_name: lastName,
    email,
    request_type_name: requestTypeName,
    discipline_name: disciplineName,
    response_count: responseCount,
    description,
    created_at: createdAt || nowIso,
  };
}

export function buildMockLegalRequestDetail({
  id,
  userId,
  requestNumber,
  status = "PENDING",
  firstName,
  lastName,
  email,
  requestTypeName,
  disciplineName,
  description,
  createdAt,
  files = [],
  responses = [],
} = {}) {
  const nowIso = new Date().toISOString();

  return {
    id,
    user: userId,
    request_number: requestNumber,
    status,
    status_display: status,
    first_name: firstName,
    last_name: lastName,
    email,
    created_at: createdAt || nowIso,
    request_type: { name: requestTypeName },
    discipline: { name: disciplineName },
    description,
    files,
    responses,
  };
}

export async function installLegalRequestsApiMocks(
  page,
  {
    userId,
    role,
    requestDescription = "Descripción de prueba",
    requestTypeName = "Consulta",
    disciplineName = "Civil",
  }
) {
  const user = buildMockUser({ id: userId, role });

  const requestId = 1001;
  const requestNumber = "REQ-1001";

  let summary = buildMockLegalRequestSummary({
    id: requestId,
    requestNumber,
    status: "PENDING",
    firstName: "Client",
    lastName: "User",
    email: "client@example.com",
    requestTypeName,
    disciplineName,
    responseCount: 0,
    description: requestDescription,
  });

  let detail = buildMockLegalRequestDetail({
    id: requestId,
    userId,
    requestNumber,
    status: "PENDING",
    firstName: "Client",
    lastName: "User",
    email: "client@example.com",
    requestTypeName,
    disciplineName,
    description: requestDescription,
    files: [],
    responses: [],
  });

  await mockApi(page, async ({ route, apiPath }) => {
    // Auth
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    // Captcha (avoid Vite proxy noise)
    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    // Users (SlideBar/UserStore)
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
        body: JSON.stringify({ has_signature: false }),
      };
    }

    // Dropdown options for create form
    if (apiPath === "dropdown_options_legal_request/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          legal_request_types: [
            { id: 1, name: requestTypeName },
            { id: 2, name: "Tutela" },
          ],
          legal_disciplines: [
            { id: 1, name: disciplineName },
            { id: 2, name: "Laboral" },
          ],
        }),
      };
    }

    // Create legal request (multipart form)
    if (apiPath === "create_legal_request/") {
      const method = route.request().method();
      if (method === "POST") {
        // Keep server state consistent for subsequent list/detail loads
        summary = { ...summary, description: requestDescription };
        detail = { ...detail, description: requestDescription };

        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ id: requestId }),
        };
      }
    }

    // Async follow-ups after creation
    if (apiPath === "send_confirmation_email/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "upload_legal_request_file/") {
      return { status: 201, contentType: "application/json", body: "{}" };
    }

    // Requests list (management store)
    if (apiPath === "legal_requests/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requests: [summary],
          count: 1,
          user_role: role,
        }),
      };
    }

    // Request detail (management store)
    if (apiPath === `legal_requests/${requestId}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail),
      };
    }

    // Create response (optional)
    if (apiPath === `legal_requests/${requestId}/responses/`) {
      const method = route.request().method();
      if (method === "POST") {
        const nowIso = new Date().toISOString();
        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            response: {
              id: 5001,
              request: requestId,
              response_text: "ok",
              created_at: nowIso,
            },
          }),
        };
      }
    }

    // Activity feed (avoid noisy calls)
    if (apiPath === "create-activity/") {
      const nowIso = new Date().toISOString();
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          action_type: "create",
          description: "",
          created_at: nowIso,
        }),
      };
    }

    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}
