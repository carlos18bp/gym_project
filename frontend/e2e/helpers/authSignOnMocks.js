import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role,
  firstName = "E2E",
  lastName = role === "lawyer" ? "Lawyer" : "Client",
  email,
  isProfileCompleted = true,
  isGymLawyer = role === "lawyer",
  hasSignature = false,
} = {}) {
  return {
    id,
    first_name: firstName,
    last_name: lastName,
    email: email || (role === "lawyer" ? "lawyer@example.com" : "client@example.com"),
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

export async function installAuthSignOnApiMocks(
  page,
  {
    userId,
    role = "client",
    signOnStatus = 200,
    passcode = "123456",
    verificationStatus = 200,
    hasSignature = false,
  }
) {
  const user = buildMockUser({ id: userId, role, hasSignature });
  const otherUser = buildMockUser({
    id: userId + 1,
    role: role === "lawyer" ? "client" : "lawyer",
    firstName: "E2E",
    lastName: role === "lawyer" ? "Client" : "Lawyer",
    email: role === "lawyer" ? "client2@example.com" : "lawyer2@example.com",
  });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    if (apiPath === "sign_on/send_verification_code/") {
      if (route.request().method() === "POST") {
        if (verificationStatus !== 200) {
          return {
            status: verificationStatus,
            contentType: "application/json",
            body: JSON.stringify({ error: "email_exists" }),
          };
        }

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ passcode }),
        };
      }
    }

    if (apiPath === "sign_on/") {
      if (route.request().method() === "POST") {
        if (signOnStatus !== 200) {
          return {
            status: signOnStatus,
            contentType: "application/json",
            body: JSON.stringify({ error: "invalid_passcode" }),
          };
        }

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access: "e2e-access-token",
            user,
          }),
        };
      }
    }

    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([user, otherUser]),
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
