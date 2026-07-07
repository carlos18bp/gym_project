import { mockApi } from "./api.js";

/**
 * Install API mocks for the admin data-reassignment module.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} options
 * @param {number} options.adminId - the logged-in admin id
 * @param {object[]} options.lawyers - lawyer user objects (may include is_archived)
 * @param {object} options.summary - the /summary/ response payload
 */
export async function installAdminReassignmentMocks(page, { adminId, role = "admin", lawyers, summary }) {
  const admin = {
    id: adminId,
    role,
    first_name: "Admin",
    last_name: "E2E",
    email: "admin@example.com",
    is_profile_completed: true,
    is_staff: role === "admin",
  };

  // Mutable copy so archive/unarchive reflect in later fetches.
  const users = [admin, ...lawyers.map((l) => ({ ...l }))];

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }
    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(users) };
    }
    if (apiPath === `users/${adminId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(admin) };
    }
    if (apiPath === "admin/reassignment/summary/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(summary) };
    }
    if (apiPath === "admin/reassignment/execute/" && route.request().method() === "POST") {
      const body = route.request().postDataJSON?.() || {};
      const target = users.find((u) => u.id === body.target_lawyer_id);
      const source = users.find((u) => u.id === body.source_lawyer_id);
      if (body.archive_source && source) source.is_archived = true;
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          transferred_processes: (body.process_ids || []).length,
          transferred_documents: (body.document_ids || []).length,
          source_archived: !!body.archive_source,
          source: { id: source?.id, full_name: `${source?.last_name} ${source?.first_name}` },
          target: { id: target?.id, full_name: `${target?.last_name} ${target?.first_name}` },
        }),
      };
    }
    const unarchiveMatch = apiPath.match(/^admin\/lawyers\/(\d+)\/unarchive\/$/);
    if (unarchiveMatch && route.request().method() === "POST") {
      const lawyer = users.find((u) => u.id === Number(unarchiveMatch[1]));
      if (lawyer) lawyer.is_archived = false;
      return { status: 200, contentType: "application/json", body: JSON.stringify(lawyer) };
    }
    // Misc dashboard/badge endpoints — empty responses keep the shell happy.
    return { status: 200, contentType: "application/json", body: "{}" };
  });
}
