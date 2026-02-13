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

export function buildMockProcess({
  id,
  clients,
  lawyer,
  caseType,
  subcase = "",
  ref = "RAD-001",
  authority = "Autoridad",
  authorityEmail = "",
  plaintiff = "",
  defendant = "",
  stages,
  progress = 0,
  caseFiles = [],
} = {}) {
  return {
    id,
    clients,
    lawyer,
    case: { type: caseType },
    subcase,
    ref,
    authority,
    authority_email: authorityEmail,
    plaintiff,
    defendant,
    stages,
    progress,
    case_files: caseFiles,
  };
}

export async function installProcessApiMocks(
  page,
  {
    userId,
    role,
    processes,
    hasSignature = false,
    users = null,
  }
) {
  const me = buildMockUser({ id: userId, role, hasSignature });
  const usersPayload = users || [me];

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(usersPayload),
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
        body: JSON.stringify({ has_signature: hasSignature }),
      };
    }

    if (apiPath === "processes/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(processes),
      };
    }

    if (apiPath.startsWith("update-recent-process/")) {
      const method = route.request().method();
      if (method === "POST") {
        return { status: 201, contentType: "application/json", body: "{}" };
      }
    }

    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}
