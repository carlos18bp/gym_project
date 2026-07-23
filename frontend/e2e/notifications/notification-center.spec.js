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

async function installServiceRequestDetailMocks(page, { userId, role, requestDetail }) {
  const me = buildMockUser({ id: userId, role });

  await mockApi(page, async ({ apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }
    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([me]) };
    }
    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(me) };
    }
    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    }
    if (apiPath === `service-requests/${requestDetail.id}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(requestDetail) };
    }
    if (apiPath === "notifications/unread-count/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ unread_count: 0 }) };
    }
    return null;
  });
}

async function installNotificationsMocks(
  page,
  { userId, role, notifications, unreadCount, requestDetail = null }
) {
  const me = buildMockUser({ id: userId, role });

  await mockApi(page, async ({ apiPath }) => {
    if (requestDetail && apiPath === `service-requests/${requestDetail.id}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(requestDetail) };
    }
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }
    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([me]) };
    }
    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(me) };
    }
    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    }
    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
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
    if (apiPath === "notifications/unread-count/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ unread_count: unreadCount }),
      };
    }
    if (apiPath.startsWith("notifications/")) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: notifications,
          count: notifications.length,
          page_size: 20,
        }),
      };
    }
    return null;
  });
}

test(
  "bell shows unread badge and navigates to notification center",
  { tag: ["@flow:notification-center", "@module:notifications", "@priority:P2", "@role:shared"] },
  async ({ page }) => {
    const userId = 5000;

    await installNotificationsMocks(page, {
      userId,
      role: "lawyer",
      notifications: [],
      unreadCount: 3,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");

    const bell = page.getByTestId("notification-bell");
    await expect(bell).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("notification-badge")).toHaveText("3");
    await expect(page.getByText("Centro de Notificaciones")).toHaveCount(0);

    await bell.click();

    await expect(page).toHaveURL(/\/notifications$/, { timeout: 15_000 });
    await expect(page.getByText("Centro de Notificaciones")).toBeVisible({ timeout: 10_000 });
  }
);

test(
  "notification center renders empty state when there are no notifications",
  { tag: ["@flow:notification-center", "@module:notifications", "@priority:P2", "@role:shared"] },
  async ({ page }) => {
    const userId = 5001;

    await installNotificationsMocks(page, {
      userId,
      role: "client",
      notifications: [],
      unreadCount: 0,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/notifications");

    await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("tab-all")).toBeVisible();
    await expect(page.getByTestId("tab-archived")).toBeVisible();
  }
);

test(
  "service request detail pulses when navigated with highlight query",
  { tag: ["@flow:notification-center", "@module:notifications", "@priority:P2", "@role:shared"] },
  async ({ page }) => {
    const userId = 5003;
    const requestId = 4242;
    const requestDetail = {
      id: requestId,
      tracking_number: "SR-001",
      requester_name: "E2E Tester",
      status: "OPEN",
      status_display: "Abierto",
      created_at: new Date().toISOString(),
      service: { id: 1, name: "Servicio de prueba" },
      answers: [],
      lawyer_responses: [],
      document_url: null,
    };

    await installServiceRequestDetailMocks(page, {
      userId,
      role: "lawyer",
      requestDetail,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto(`/service_requests/${requestId}?highlight=${requestId}`);

    // quality: allow-fragile-selector (notification-highlight is the semantic class for the highlight feature being tested)
    const card = page.locator(".notification-highlight").first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveClass(/notification-highlight/);

    // After ~5s the highlight class is removed and the URL query param is cleared.
    // quality: allow-fragile-selector (notification-highlight is the semantic class for the highlight feature being tested)
    await expect(page.locator(".notification-highlight")).toHaveCount(0, { timeout: 8000 });
    await expect(page).toHaveURL(/\/service_requests\/4242($|\?)(?!.*highlight=)/);
  }
);

test(
  "service request highlight does not fade the text (B2 regression for animate-pulse)",
  { tag: ["@flow:notification-center", "@module:notifications", "@priority:P2", "@role:shared"] },
  async ({ page }) => {
    // Regression: the previous implementation used Tailwind's ``animate-pulse``
    // which animates the element's ``opacity`` from 1 to 0.5 — fading text
    // included. The fix replaced it with a local ``notification-highlight``
    // keyframe that animates only background-color and box-shadow. This test
    // samples the inner text's computed ``opacity`` mid-animation and asserts
    // it stays at 1.
    const userId = 5004;
    const requestId = 4243;
    const requestDetail = {
      id: requestId,
      tracking_number: "SR-OPACITY",
      requester_name: "E2E Opacity",
      status: "OPEN",
      status_display: "Abierto",
      created_at: new Date().toISOString(),
      service: { id: 1, name: "Opacity test service" },
      answers: [],
      lawyer_responses: [],
      document_url: null,
    };

    await installNotificationsMocks(page, {
      userId,
      role: "lawyer",
      unreadCount: 1,
      requestDetail,
      notifications: [
        {
          id: 77,
          title: "Nueva solicitud de servicio",
          message: "Revisa la solicitud SR-OPACITY",
          category: "service_request",
          priority: "high",
          is_read: false,
          is_archived: false,
          snoozed_until: null,
          link_type: "service_request",
          link_id: requestId,
          created_at: new Date().toISOString(),
        },
      ],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    // Reach the highlight the way the user does: open the notification.
    await page.goto("/notifications");
    await page.getByTestId("notification-77").click();

    await expect(page).toHaveURL(
      new RegExp(`/service_requests/${requestId}\\?highlight=${requestId}`),
      { timeout: 15_000 }
    );

    // quality: allow-fragile-selector (notification-highlight is the semantic class for the highlight feature being tested)
    const card = page.locator(".notification-highlight").first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Poll the computed opacity of inner text repeatedly while the keyframe
    // is running. With animate-pulse, opacity dropped to 0.5 at the 50% mark;
    // with notification-highlight, the keyframe never touches opacity so
    // every sample must stay at 1. Using expect.poll instead of a fixed
    // waitForTimeout avoids flakiness and the brittle-wait quality rule.
    const sampleOpacity = () =>
      card.evaluate((el) => {
        const children = el.querySelectorAll("h1, h2, h3, p, span");
        if (children.length === 0) return 1;
        let minOpacity = 1;
        for (const child of children) {
          const op = parseFloat(window.getComputedStyle(child).opacity);
          if (op < minOpacity) minOpacity = op;
        }
        return minOpacity;
      });

    // Poll every ~50ms for the first 1.5s of the animation; any value below
    // 0.99 indicates the text is fading and the regression has returned.
    await expect.poll(sampleOpacity, { intervals: [50, 50, 50], timeout: 1500 })
      .toBeGreaterThanOrEqual(0.99);
  }
);

test(
  "notification center lists notifications and switches tabs",
  { tag: ["@flow:notification-center", "@module:notifications", "@priority:P2", "@role:shared"] },
  async ({ page }) => {
    const userId = 5002;

    const nowIso = new Date().toISOString();
    const notifications = [
      {
        id: 1,
        title: "Documento pendiente de firma",
        message: "Tienes un documento pendiente",
        category: "signature_request",
        priority: "high",
        is_read: false,
        is_archived: false,
        snoozed_until: null,
        link_type: "document",
        link_id: 99,
        created_at: nowIso,
      },
      {
        id: 2,
        title: "Proceso actualizado",
        message: "Hay novedades en tu proceso",
        category: "process_alert",
        priority: "medium",
        is_read: true,
        is_archived: false,
        snoozed_until: null,
        link_type: "process",
        link_id: 42,
        created_at: nowIso,
      },
    ];

    await installNotificationsMocks(page, {
      userId,
      role: "lawyer",
      notifications,
      unreadCount: 1,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/notifications");

    await expect(page.getByTestId("notification-1")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("notification-2")).toBeVisible();

    await page.getByTestId("tab-archived").click();
    await page.getByTestId("tab-all").click();

    await expect(page.getByTestId("notification-1")).toBeVisible();
  }
);
