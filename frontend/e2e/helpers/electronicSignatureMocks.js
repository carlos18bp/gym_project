import { mockApi } from "./api.js";

export const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6qg3kAAAAASUVORK5CYII=";

export function buildMockUser({ id, hasSignature }) {
  return {
    id,
    first_name: "E2E",
    last_name: "User",
    email: "e2e@example.com",
    role: "client",
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    is_profile_completed: true,
    has_signature: hasSignature,
  };
}

export async function installElectronicSignatureApiMocks(page, { userId }) {
  let hasSignature = false;
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    // Auth
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    // Users list
    if (apiPath === "users/") {
      const user = buildMockUser({ id: userId, hasSignature });
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([user]),
      };
    }

    // Get user detail
    if (apiPath === `users/${userId}/`) {
      const user = buildMockUser({ id: userId, hasSignature });
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(user),
      };
    }

    // Signature fetch
    if (apiPath === `users/${userId}/signature/`) {
      if (!hasSignature) {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ has_signature: false }),
        };
      }

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          has_signature: true,
          signature: {
            signature_image: "https://example.com/signature.png",
            method: "upload",
            created_at: nowIso,
          },
        }),
      };
    }

    // Upload signature
    if (apiPath === `users/update_signature/${userId}/`) {
      hasSignature = true;
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "ok" }),
      };
    }

    // Dashboard auxiliary endpoints
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
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          action_type: "update",
          description: "",
          created_at: nowIso,
        }),
      };
    }

    // Fall through to default mockApi behavior for everything else
    return null;
  });
}
