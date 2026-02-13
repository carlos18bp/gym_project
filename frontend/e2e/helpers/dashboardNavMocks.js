import { mockApi } from "./api.js";

function buildMockUser({
  id,
  role,
  firstName = "E2E",
  lastName = role === "lawyer" ? "Lawyer" : "Client",
  email = "e2e@example.com",
  isProfileCompleted = true,
  isGymLawyer = role === "lawyer",
  hasSignature = false,
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
    has_signature: hasSignature,
  };
}

function buildMockProcess({ id, lawyerId, clientId } = {}) {
  return {
    id,
    clients: [
      {
        id: clientId,
        first_name: "Client",
        last_name: "One",
        email: "client@example.com",
        role: "client",
        photo_profile: "",
      },
    ],
    lawyer: { id: lawyerId },
    case: { type: "Civil" },
    subcase: "Subcaso",
    ref: `RAD-${id}`,
    authority: "Juzgado 1",
    authority_email: "juzgado1@example.com",
    plaintiff: "Demandante",
    defendant: "Demandado",
    stages: [{ status: "Inicio" }],
    progress: 10,
    case_files: [],
  };
}

export async function installDashboardNavApiMocks(
  page,
  { userId, role = "lawyer", isGymLawyer = true }
) {
  const me = buildMockUser({
    id: userId,
    role,
    isGymLawyer,
    isProfileCompleted: true,
    hasSignature: false,
  });

  const other = buildMockUser({
    id: userId + 1,
    role: role === "lawyer" ? "client" : "lawyer",
    firstName: "E2E",
    lastName: role === "lawyer" ? "Client" : "Lawyer",
    email: role === "lawyer" ? "client2@example.com" : "lawyer2@example.com",
    isGymLawyer: role !== "lawyer",
  });

  const processes = [
    buildMockProcess({ id: 9001, lawyerId: role === "lawyer" ? userId : 5000, clientId: role === "lawyer" ? other.id : userId }),
  ];

  const nowIso = new Date().toISOString();

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

    // Users
    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([me, other]),
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
        body: JSON.stringify({ has_signature: false }),
      };
    }

    // Dashboard
    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "create-activity/") {
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }),
      };
    }

    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([]) };
    }

    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([]) };
    }

    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([]) };
    }

    // Process list
    if (apiPath === "processes/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(processes),
      };
    }

    // Legal requests list (used by LegalRequestsList.vue)
    if (apiPath === "legal_requests/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requests: [
            {
              id: 1001,
              request_number: "REQ-1001",
              status: "PENDING",
              status_display: "PENDING",
              first_name: "Client",
              last_name: "One",
              email: "client@example.com",
              request_type_name: "Consulta",
              discipline_name: "Civil",
              response_count: 0,
              description: "Descripción de prueba",
              created_at: nowIso,
            },
          ],
          count: 1,
          user_role: role,
        }),
      };
    }

    // Dynamic documents dashboard
    // NOTE: query params are stripped by mockApi (URL.pathname only)
    if (apiPath === "dynamic-documents/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 101,
            title: "Minuta A",
            state: "Draft",
            created_by: userId,
            assigned_to: null,
            code: "DOC-101",
            tags: [],
            created_at: nowIso,
            updated_at: nowIso,
            content: "",
            variables: [],
          },
        ]),
      };
    }

    if (apiPath === "dynamic-documents/folders/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 201,
            name: "Carpeta 1",
            color_id: 0,
            documents: [],
            created_at: nowIso,
            document_ids: [],
          },
        ]),
      };
    }

    // Some components use POST to update recents
    if (apiPath.startsWith("update-recent-process/")) {
      if (route.request().method() === "POST") {
        return { status: 201, contentType: "application/json", body: "{}" };
      }
    }

    return null;
  });
}
