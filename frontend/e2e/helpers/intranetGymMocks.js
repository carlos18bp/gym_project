import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role,
  firstName = "E2E",
  lastName = "Lawyer",
  email = "lawyer@example.com",
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
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
    has_signature: true,
  };
}

export function buildMockIntranetDoc({ id, name, fileUrl = "https://example.test/file.docx" } = {}) {
  return {
    id,
    name,
    file_url: fileUrl,
  };
}

export async function installUnsplashImageStub(page) {
  // Prevent external network flakiness for the default cover/profile images
  await page.route("**://images.unsplash.com/**", async (route) => {
    // 1x1 transparent PNG
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X3qO8AAAAASUVORK5CYII=";

    return route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(pngBase64, "base64"),
    });
  });
}

export async function installIntranetGymApiMocks(page, { userId, role = "lawyer", documents = [] }) {
  const me = buildMockUser({ id: userId, role });

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

    if (apiPath === "list_legal_intranet_documents/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          documents,
          profile: {
            cover_image_url: "",
            profile_image_url: "",
          },
          lawyers_count: 3,
          users_count: 42,
        }),
      };
    }

    if (apiPath === "create_report_request/") {
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1 }),
      };
    }

    // Activity feed call after successful report
    if (apiPath === "create-activity/") {
      const now = new Date().toISOString();
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "create", description: "", created_at: now }),
      };
    }

    // Dashboard misc endpoints (redirect after success)
    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "user-activities/") {
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
