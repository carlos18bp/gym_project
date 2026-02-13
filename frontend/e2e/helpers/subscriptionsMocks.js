import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role,
  hasSignature = false,
  isProfileCompleted = true,
  isGymLawyer = false,
} = {}) {
  return {
    id,
    first_name: "E2E",
    last_name: "User",
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

export function buildMockSubscription({
  planType = "basico",
  status = "active",
  nextBillingDate = null,
} = {}) {
  return {
    id: 1,
    plan_type: planType,
    status,
    next_billing_date: nextBillingDate,
  };
}

export async function installSubscriptionsApiMocks(
  page,
  {
    userId,
    role = "client",
    hasSignature = false,
    currentSubscription = null,
  }
) {
  const user = buildMockUser({ id: userId, role, hasSignature });

  await mockApi(page, async ({ route, apiPath }) => {
    // Auth
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    // Users
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
        body: JSON.stringify({ has_signature: hasSignature }),
      };
    }

    // Subscriptions
    if (apiPath === "subscriptions/current/") {
      if (!currentSubscription) {
        return { status: 404, contentType: "application/json", body: "{}" };
      }

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(currentSubscription),
      };
    }

    if (apiPath === "subscriptions/history/") {
      return {
        status: 200,
        contentType: "application/json",
        body: "[]",
      };
    }

    if (apiPath === "subscriptions/create/") {
      const method = route.request().method();
      if (method === "POST") {
        const body = route.request().postDataJSON?.() || {};
        const planType = body.plan_type || "basico";

        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(buildMockSubscription({ planType, status: "active" })),
        };
      }
    }

    // Captcha (some views may request this opportunistically)
    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    // Dashboard auxiliary endpoints (used after checkout redirects to /dashboard)
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
      const nowIso = new Date().toISOString();
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "update", description: "", created_at: nowIso }),
      };
    }

    return null;
  });
}
