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

export async function installAuthSignInApiMocks(
  page,
  {
    userId,
    role,
    signInStatus = 200,
    hasSignature = false,
  }
) {
  const user = buildMockUser({ id: userId, role, hasSignature });

  // Provide a second user so dashboard contacts widget can render a list deterministically.
  const otherUser = buildMockUser({
    id: userId + 1,
    role: role === "lawyer" ? "client" : "lawyer",
    firstName: "E2E",
    lastName: role === "lawyer" ? "Client" : "Lawyer",
    email: role === "lawyer" ? "client2@example.com" : "lawyer2@example.com",
  });

  await mockApi(page, async ({ route, apiPath }) => {
    // Captcha
    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    // Sign in
    if (apiPath === "sign_in/") {
      const method = route.request().method();
      if (method === "POST") {
        if (signInStatus !== 200) {
          return {
            status: signInStatus,
            contentType: "application/json",
            body: JSON.stringify({ error: "invalid_credentials" }),
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

    // Auth validation
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    // Users (SlideBar/UserStore + dashboard widgets)
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

    // Dashboard endpoints
    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "create-activity/") {
      const nowIso = new Date().toISOString();
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

    return null;
  });
}
