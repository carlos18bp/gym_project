import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E for the notification-center item actions: mark read/unread (single and
 * bulk), snooze, archive/unarchive, delete and pagination. Complements
 * notification-center.spec.js, which covers bell/badge/tabs/deep-links.
 */

function buildMockUser(id) {
  return {
    id,
    first_name: "E2E",
    last_name: "Lawyer",
    email: "e2e@example.com",
    role: "lawyer",
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    created_at: new Date().toISOString(),
    is_profile_completed: true,
    is_gym_lawyer: true,
    has_signature: false,
  };
}

function buildNotification(id, overrides = {}) {
  return {
    id,
    title: `Notificación ${id}`,
    message: `Mensaje ${id}`,
    category: "general",
    priority: "medium",
    is_read: false,
    is_archived: false,
    snoozed_until: null,
    link_type: "",
    link_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Stateful notifications API mock: action endpoints mutate the in-memory list
 * so refetches observe the new state, mirroring the real backend contract.
 */
async function installStatefulNotificationsMocks(page, { userId, notifications, pageSize = 20 }) {
  const me = buildMockUser(userId);
  const items = notifications.map((n) => ({ ...n }));

  await mockApi(page, async ({ route, apiPath }) => {
    const json = (body, status = 200) => ({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (apiPath === "validate_token/") return json({});
    if (apiPath === "users/") return json([me]);
    if (apiPath === `users/${userId}/`) return json(me);
    if (apiPath === `users/${userId}/signature/`) return json({ has_signature: false });
    if (["user-activities/", "processes/", "recent-processes/", "dynamic-documents/recent/", "legal-updates/active/"].includes(apiPath)) {
      return json([]);
    }
    if (apiPath === "notifications/unread-count/") {
      return json({ unread_count: items.filter((n) => !n.is_read && !n.is_archived).length });
    }
    if (apiPath === "notifications/mark-all-read/") {
      let updated = 0;
      items.forEach((n) => {
        if (!n.is_read) {
          n.is_read = true;
          updated += 1;
        }
      });
      return json({ updated });
    }

    const action = apiPath.match(/^notifications\/(\d+)\/(read|unread|archive|unarchive|snooze|delete)\/$/);
    if (action) {
      const id = Number(action[1]);
      const idx = items.findIndex((n) => n.id === id);
      if (idx === -1) return json({ detail: "not found" }, 404);
      const verb = action[2];
      if (verb === "read") items[idx].is_read = true;
      if (verb === "unread") items[idx].is_read = false;
      if (verb === "archive") items[idx].is_archived = true;
      if (verb === "unarchive") items[idx].is_archived = false;
      if (verb === "snooze") items[idx].snoozed_until = "2099-01-01T00:00:00Z";
      if (verb === "delete") items.splice(idx, 1);
      return json({ status: "ok" });
    }

    if (apiPath === "notifications/") {
      const url = new URL(route.request().url());
      const tab = url.searchParams.get("tab") || "all";
      const pageNum = Number(url.searchParams.get("page") || 1);
      const visible = items.filter((n) =>
        tab === "archived" ? n.is_archived : !n.is_archived && !n.snoozed_until
      );
      const start = (pageNum - 1) * pageSize;
      return json({
        results: visible.slice(start, start + pageSize),
        count: visible.length,
        page_size: pageSize,
      });
    }
    return null;
  });
}

async function openNotifications(page, { notifications, pageSize } = {}) {
  const userId = 5100;
  await installStatefulNotificationsMocks(page, { userId, notifications, pageSize });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });
  await page.goto("/notifications");
  await expect(page.getByTestId("notifications-table")).toBeVisible({ timeout: 15_000 });
}

test(
  "marking a notification read updates its row and the unread badge",
  { tag: ["@flow:notification-mark-read", "@module:notifications", "@priority:P3", "@role:shared"] },
  async ({ page }) => {
    await openNotifications(page, { notifications: [buildNotification(1), buildNotification(2)] });
    await expect(page.getByTestId("notification-badge")).toHaveText("2");

    await page.getByTestId("mark-read-1").click();

    await expect(page.getByTestId("mark-unread-1")).toBeVisible();
    await expect(page.getByTestId("notification-badge")).toHaveText("1");
  }
);

test(
  "mark-all-read clears every unread notification",
  { tag: ["@flow:notification-mark-read", "@module:notifications", "@priority:P3", "@role:shared"] },
  async ({ page }) => {
    await openNotifications(page, { notifications: [buildNotification(1), buildNotification(2)] });

    await page.getByTestId("mark-all-read-btn").click();

    await expect(page.getByTestId("mark-unread-1")).toBeVisible();
    await expect(page.getByTestId("mark-unread-2")).toBeVisible();
    await expect(page.getByTestId("notification-badge")).toHaveCount(0);
  }
);

test(
  "snoozing a notification hides it from the active list",
  { tag: ["@flow:notification-snooze", "@module:notifications", "@priority:P3", "@role:shared"] },
  async ({ page }) => {
    await openNotifications(page, { notifications: [buildNotification(1), buildNotification(2)] });

    const row = page.getByTestId("notification-1");
    await row.getByTitle("Recordar después").click();
    await page.getByRole("button", { name: "1 hora" }).click();

    await expect(page.getByTestId("notification-1")).toHaveCount(0);
    await expect(page.getByTestId("notification-2")).toBeVisible();
  }
);

test(
  "archiving moves a notification to the archived tab and back",
  { tag: ["@flow:notification-archive-toggle", "@module:notifications", "@priority:P3", "@role:shared"] },
  async ({ page }) => {
    await openNotifications(page, { notifications: [buildNotification(1), buildNotification(2)] });

    await page.getByTestId("archive-1").click();
    await expect(page.getByTestId("notification-1")).toHaveCount(0);

    await page.getByTestId("tab-archived").click();
    await expect(page.getByTestId("notification-1")).toBeVisible();

    await page.getByTestId("unarchive-1").click();
    await expect(page.getByTestId("notification-1")).toHaveCount(0);

    await page.getByTestId("tab-all").click();
    await expect(page.getByTestId("notification-1")).toBeVisible();
  }
);

test(
  "deleting a notification removes it permanently",
  { tag: ["@flow:notification-delete", "@module:notifications", "@priority:P3", "@role:shared"] },
  async ({ page }) => {
    await openNotifications(page, { notifications: [buildNotification(1), buildNotification(2)] });

    await page.getByTestId("delete-1").click();

    await expect(page.getByTestId("notification-1")).toHaveCount(0);
    await expect(page.getByTestId("notification-2")).toBeVisible();
  }
);

test(
  "pagination navigates between notification pages",
  { tag: ["@flow:notification-pagination", "@module:notifications", "@priority:P4", "@role:shared"] },
  async ({ page }) => {
    const many = [1, 2, 3, 4, 5].map((id) => buildNotification(id));
    await openNotifications(page, { notifications: many, pageSize: 3 });

    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await expect(page.getByTestId("notification-1")).toBeVisible();
    await expect(page.getByTestId("notification-4")).toHaveCount(0);

    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByText("Página 2 de 2")).toBeVisible();
    await expect(page.getByTestId("notification-4")).toBeVisible();

    await page.getByRole("button", { name: "Anterior" }).click();
    await expect(page.getByText("Página 1 de 2")).toBeVisible();
  }
);

test(
  "mobile viewport shows the top bar and archiving works from a phone",
  { tag: ["@flow:notification-archive-toggle", "@module:notifications", "@priority:P4", "@role:shared"] },
  async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openNotifications(page, { notifications: [buildNotification(1), buildNotification(2)] });

    // The sticky mobile top bar only renders below lg
    // quality: allow-fragile-selector (structural mobile bar has no text content to anchor on)
    await expect(page.locator("div.sticky.top-0.lg\\:hidden").first()).toBeVisible();

    await page.getByTestId("archive-1").click();
    await expect(page.getByTestId("notification-1")).toHaveCount(0);

    await page.getByTestId("tab-archived").click();
    await expect(page.getByTestId("notification-1")).toBeVisible();
  }
);
