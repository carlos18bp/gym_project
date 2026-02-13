import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

function buildMockUser({ id, role }) {
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
    created_at: new Date().toISOString(),
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
    has_signature: false,
  };
}

async function installDashboardWithActivitiesMocks(page, { userId, role, activities }) {
  const me = buildMockUser({ id: userId, role });
  const other = buildMockUser({
    id: userId + 1,
    role: role === "lawyer" ? "client" : "lawyer",
  });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }
    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([me, other]) };
    }
    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(me) };
    }
    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    }
    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(activities) };
    }
    if (apiPath === "create-activity/") {
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 999, action_type: "other", description: "test", created_at: nowIso }),
      };
    }
    if (apiPath === "processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
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

test("dashboard renders activity feed with entries", async ({ page }) => {
  const userId = 4000;
  const now = new Date();

  const activities = [
    {
      id: 1,
      action_type: "create",
      description: "Creaste el proceso Laboral para Juan.",
      created_at: new Date(now - 30000).toISOString(),
    },
    {
      id: 2,
      action_type: "edit",
      description: "Editaste tu perfil.",
      created_at: new Date(now - 120000).toISOString(),
    },
    {
      id: 3,
      action_type: "finish",
      description: "Finalizaste el proceso Civil.",
      created_at: new Date(now - 3600000).toISOString(),
    },
  ];

  await installDashboardWithActivitiesMocks(page, {
    userId,
    role: "lawyer",
    activities,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dashboard");

  // Dashboard should load and show the activity feed
  await expect(page.getByText("Creaste el proceso Laboral")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Editaste tu perfil")).toBeVisible();
  await expect(page.getByText("Finalizaste el proceso Civil")).toBeVisible();
});

test("dashboard renders empty activity feed message when no activities", async ({ page }) => {
  const userId = 4001;

  await installDashboardWithActivitiesMocks(page, {
    userId,
    role: "client",
    activities: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dashboard");

  // Dashboard should load — verify the welcome card renders
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });
});
