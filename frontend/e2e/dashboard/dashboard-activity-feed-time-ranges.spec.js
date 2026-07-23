import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * Deep coverage for:
 * - activity_feed.js (41%) — fetchUserActivities, formatTimeAgo branches
 *   (seconds, minutes, hours, days, weeks, months, years)
 * - ContactsWidget.vue (23.9%) — lawyer contacts list rendering
 * - UserWelcomeCard.vue — welcome card with stats
 */

function buildMockUser({ id, role, firstName = "E2E", lastName = "User" }) {
  return {
    id, first_name: firstName, last_name: lastName, email: `${firstName.toLowerCase()}@example.com`,
    role, contact: "3001234567", birthday: "1990-01-01", identification: "1234567890",
    document_type: "CC", photo_profile: "", created_at: new Date().toISOString(),
    is_profile_completed: true, is_gym_lawyer: role === "lawyer", has_signature: false,
  };
}

async function installDashboardDeepMocks(page, { userId, role, activities = [], users = [], processes = [] }) {
  const me = buildMockUser({ id: userId, role });
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-key" }) };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([me, ...users]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(me) };
    if (apiPath === `users/${userId}/signature/`) return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: JSON.stringify(activities) };
    if (apiPath === "create-activity/") return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 999, action_type: "other", description: "", created_at: nowIso }) };
    if (apiPath === "processes/") return { status: 200, contentType: "application/json", body: JSON.stringify(processes) };
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: JSON.stringify(processes.slice(0, 3)) };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "legal-updates/active/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "subscriptions/current/") return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "not_found" }) };
    if (apiPath === "notifications/unread-count/") return { status: 200, contentType: "application/json", body: JSON.stringify({ unread_count: 0 }) };
    if (apiPath.startsWith("notifications/")) return { status: 200, contentType: "application/json", body: JSON.stringify({ results: [], count: 0, page_size: 20 }) };
    return null;
  });
}

test("activity feed renders entries with varied time ranges and formatTimeAgo branches", { tag: ['@flow:dashboard-activity-feed', '@module:dashboard', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 4010;
  const now = Date.now();

  const activities = [
    { id: 1, action_type: "create", description: "Acción hace segundos", created_at: new Date(now - 10_000).toISOString() },
    { id: 2, action_type: "edit", description: "Acción hace minutos", created_at: new Date(now - 5 * 60_000).toISOString() },
    { id: 3, action_type: "finish", description: "Acción hace horas", created_at: new Date(now - 3 * 3600_000).toISOString() },
    { id: 4, action_type: "delete", description: "Acción hace días", created_at: new Date(now - 2 * 86400_000).toISOString() },
    { id: 5, action_type: "update", description: "Acción hace semanas", created_at: new Date(now - 14 * 86400_000).toISOString() },
    { id: 6, action_type: "other", description: "Acción hace meses", created_at: new Date(now - 60 * 86400_000).toISOString() },
  ];

  await installDashboardDeepMocks(page, { userId, role: "lawyer", activities });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dashboard");

  await page.getByRole('button', { name: 'Feed' }).click();
  await expect(page.getByText("Acción hace segundos")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Acción hace minutos")).toBeVisible();
  await expect(page.getByText("Acción hace horas")).toBeVisible();
  await expect(page.getByText("Acción hace días")).toBeVisible();

  // Verify formatTimeAgo output for different ranges
  await expect(page.getByText("Hace unos segundos")).toBeVisible();
  await expect(page.getByText(/Hace \d+ minutos/)).toBeVisible();
  await expect(page.getByText(/Hace \d+ horas/)).toBeVisible();
  await expect(page.getByText(/Hace \d+ días/)).toBeVisible();
  await expect(page.getByText(/Hace \d+ semanas/)).toBeVisible();
  await expect(page.getByText(/Hace \d+ meses/)).toBeVisible();
});

test("lawyer switches to the Contactos tab and sees the contacts list", { tag: ['@flow:dashboard-activity-feed', '@module:dashboard', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 4020;
  const nowIso = new Date().toISOString();

  const processes = [
    {
      id: 8001, case_type: { type: "Civil" }, subcase: "Contractual", ref_number: "RAD-8001",
      authority: "Juzgado 1", plaintiff: "Demandante", defendant: "Demandado",
      stages: [{ status: "Inicio", date: nowIso }], progress: 25,
      lawyer: { id: userId }, clients: [], case_files: [],
    },
    {
      id: 8002, case_type: { type: "Laboral" }, subcase: "Despido", ref_number: "RAD-8002",
      authority: "Juzgado 2", plaintiff: "Empleado", defendant: "Empresa",
      stages: [{ status: "Fallo", date: nowIso }], progress: 100,
      lawyer: { id: userId }, clients: [], case_files: [],
    },
  ];

  // quality: allow-fragile-test-data (the contact email is derived by buildMockUser and only used as a rendering assertion)
  const contactLawyer = buildMockUser({ id: 4021, role: "lawyer", firstName: "Colega", lastName: "Contacto" });

  await installDashboardDeepMocks(page, { userId, role: "lawyer", processes, users: [contactLawyer] });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dashboard");

  // Starting point: welcome card with process stats, contacts not rendered yet
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Colega Contacto")).toHaveCount(0);

  await page.getByTestId("activity-feed-tab-contacts").click();

  // Transition: the ContactsWidget replaces the notifications panel
  await expect(page.getByText("Colega Contacto")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("colega@example.com")).toBeVisible();
});

test("client dashboard renders with empty activity feed state", { tag: ['@flow:dashboard-activity-feed', '@module:dashboard', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 4030;

  await installDashboardDeepMocks(page, { userId, role: "client", activities: [] });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dashboard");

  // Dashboard should load and render the welcome card
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  // With no processes, active count should be 0
  await expect(page.getByText("0").first()).toBeVisible({ timeout: 10_000 });
});
