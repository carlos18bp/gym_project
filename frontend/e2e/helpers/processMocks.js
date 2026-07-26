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

/**
 * Builds a process payload shaped like gym_app.serializers.ProcessSerializer.
 *
 * `caseTypeId` mirrors CaseSerializer's `['id', 'type']`: the real API always
 * nests the case id, and ProcessForm's edit mode hydrates its case-type
 * selector straight from `process.case` (assignProcessToFormData), then submits
 * `selectedCaseType.id` as `caseTypeId`. A process built without it renders
 * fine but cannot be SAVED — validateFormData() rejects the empty
 * "Tipo de Caso" and no update request is ever issued. Any spec that clicks
 * "Guardar Proceso" on an existing process must pass it.
 * Left optional (undefined serializes away) so read-only specs stay unchanged.
 */
export function buildMockProcess({
  id,
  clients,
  lawyer,
  caseType,
  caseTypeId,
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
    case: { id: caseTypeId, type: caseType },
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
