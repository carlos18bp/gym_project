import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role = "client",
  firstName = "E2E",
  lastName = "User",
  email = "e2e@example.com",
  isProfileCompleted = true,
  isGymLawyer = role === "lawyer",
  hasSignature = false,
  contact = "3001234567",
  birthday = "1990-01-15",
  identification = "123456789",
  documentType = "CC",
} = {}) {
  return {
    id,
    first_name: firstName,
    last_name: lastName,
    email,
    role,
    contact,
    birthday,
    identification,
    document_type: documentType,
    photo_profile: "",
    is_profile_completed: isProfileCompleted,
    is_gym_lawyer: isGymLawyer,
    has_signature: hasSignature,
  };
}

export async function installProfileApiMocks(
  page,
  {
    userId,
    role = "client",
    firstName = "E2E",
    lastName = "User",
    email = "e2e@example.com",
    isProfileCompleted = true,
    hasSignature = false,
    updateProfileStatus = 200,
  }
) {
  let user = buildMockUser({
    id: userId,
    role,
    firstName,
    lastName,
    email,
    isProfileCompleted,
    hasSignature,
  });

  const other = buildMockUser({
    id: userId + 1,
    role: role === "lawyer" ? "client" : "lawyer",
    firstName: "Other",
    lastName: role === "lawyer" ? "Client" : "Lawyer",
    email: "other@example.com",
  });

  const nowIso = new Date().toISOString();

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
        body: JSON.stringify([user, other]),
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
        body: JSON.stringify({ has_signature: user.has_signature }),
      };
    }

    if (apiPath === `update_profile/${userId}/`) {
      if (route.request().method() === "PUT") {
        if (updateProfileStatus !== 200) {
          return {
            status: updateProfileStatus,
            contentType: "application/json",
            body: JSON.stringify({ error: "update_failed" }),
          };
        }
        user = { ...user, is_profile_completed: true };
        return { status: 200, contentType: "application/json", body: "{}" };
      }
    }

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
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/recent/") {
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
