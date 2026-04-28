import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useNotificationStore } from "@/stores/notification";

const mock = new AxiosMockAdapter(axios);

describe("Notification Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ── fetchNotifications ──────────────────────────────────────────

  test("fetchNotifications populates notifications from API response", async () => {
    const store = useNotificationStore();
    mock.onGet(/notifications\//).reply(200, {
      results: [{ id: 1, title: "Test" }],
      count: 1,
      page_size: 20,
    });

    await store.fetchNotifications("all", 1);

    expect(store.notifications).toEqual([{ id: 1, title: "Test" }]);
    expect(store.totalCount).toBe(1);
    expect(store.currentTab).toBe("all");
    expect(store.currentPage).toBe(1);
    expect(store.dataLoaded).toBe(true);
  });

  test("fetchNotifications resets on error", async () => {
    const store = useNotificationStore();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet(/notifications\//).reply(500);

    await store.fetchNotifications("all", 1);

    expect(store.notifications).toEqual([]);
    expect(store.totalCount).toBe(0);

    consoleSpy.mockRestore();
  });

  // ── fetchUnreadCount ────────────────────────────────────────────

  test("fetchUnreadCount updates unreadCount from API", async () => {
    const store = useNotificationStore();
    mock.onGet(/unread-count/).reply(200, { unread_count: 5 });

    await store.fetchUnreadCount();

    expect(store.unreadCount).toBe(5);
  });

  test("fetchUnreadCount handles error gracefully", async () => {
    const store = useNotificationStore();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet(/unread-count/).reply(500);

    await store.fetchUnreadCount();

    expect(store.unreadCount).toBe(0);

    consoleSpy.mockRestore();
  });

  // ── markAsRead ──────────────────────────────────────────────────

  test("markAsRead updates local notification state", async () => {
    const store = useNotificationStore();
    store.$patch({
      notifications: [{ id: 10, is_read: false }],
      unreadCount: 1,
    });

    mock.onPost(/10\/read/).reply(200, {});

    await store.markAsRead(10);

    expect(store.notifications[0].is_read).toBe(true);
    expect(store.unreadCount).toBe(0);
  });

  // ── markAllRead ─────────────────────────────────────────────────

  test("markAllRead sets all notifications to read", async () => {
    const store = useNotificationStore();
    store.$patch({
      notifications: [
        { id: 1, is_read: false },
        { id: 2, is_read: false },
      ],
      unreadCount: 2,
    });

    mock.onPost(/mark-all-read/).reply(200, { updated: 2 });

    const updated = await store.markAllRead();

    expect(updated).toBe(2);
    expect(store.unreadCount).toBe(0);
    expect(store.notifications.every((n) => n.is_read)).toBe(true);
  });

  // ── archiveNotification ─────────────────────────────────────────

  test("archiveNotification removes item from local list", async () => {
    const store = useNotificationStore();
    store.$patch({
      notifications: [{ id: 5, is_read: false }],
      totalCount: 1,
      unreadCount: 1,
    });

    mock.onPost(/5\/archive/).reply(200, {});
    mock.onGet(/unread-count/).reply(200, { unread_count: 0 });

    await store.archiveNotification(5);

    expect(store.notifications).toEqual([]);
    expect(store.totalCount).toBe(0);
  });

  // ── snoozeNotification ──────────────────────────────────────────

  test("snoozeNotification removes item from local list", async () => {
    const store = useNotificationStore();
    store.$patch({
      notifications: [{ id: 7, is_read: false }],
      totalCount: 1,
      unreadCount: 1,
    });

    mock.onPost(/7\/snooze/).reply(200, {});
    mock.onGet(/unread-count/).reply(200, { unread_count: 0 });

    await store.snoozeNotification(7, "1h");

    expect(store.notifications).toEqual([]);
    expect(store.totalCount).toBe(0);
  });

  // ── deleteNotification ──────────────────────────────────────────

  test("deleteNotification removes item from local list", async () => {
    const store = useNotificationStore();
    store.$patch({
      notifications: [{ id: 3, is_read: true }],
      totalCount: 1,
    });

    mock.onDelete(/3\/delete/).reply(204);
    mock.onGet(/unread-count/).reply(200, { unread_count: 0 });

    await store.deleteNotification(3);

    expect(store.notifications).toEqual([]);
    expect(store.totalCount).toBe(0);
  });

  // ── Getters ─────────────────────────────────────────────────────

  test("hasUnread returns true when unreadCount > 0", () => {
    const store = useNotificationStore();
    store.$patch({ unreadCount: 3 });
    expect(store.hasUnread).toBe(true);
  });

  test("hasUnread returns false when unreadCount is 0", () => {
    const store = useNotificationStore();
    expect(store.hasUnread).toBe(false);
  });

  test("latestNotifications returns first 3 items", () => {
    const store = useNotificationStore();
    store.$patch({
      notifications: [
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
      ],
    });
    expect(store.latestNotifications).toHaveLength(3);
    expect(store.latestNotifications.map((n) => n.id)).toEqual([1, 2, 3]);
  });

  // ── Polling ─────────────────────────────────────────────────────

  test("startPolling begins interval and fetches immediately", () => {
    const store = useNotificationStore();
    mock.onGet(/unread-count/).reply(200, { unread_count: 0 });

    store.startPolling();

    expect(store.pollingInterval).not.toBeNull();

    store.stopPolling();
  });

  test("stopPolling clears the interval", () => {
    const store = useNotificationStore();
    mock.onGet(/unread-count/).reply(200, { unread_count: 0 });

    store.startPolling();
    expect(store.pollingInterval).not.toBeNull();

    store.stopPolling();
    expect(store.pollingInterval).toBeNull();
  });

  // ── navigateToNotificationTarget ────────────────────────────────

  test("navigateToNotificationTarget routes process links with highlight", () => {
    const store = useNotificationStore();
    const router = { push: jest.fn() };
    store.navigateToNotificationTarget(router, { link_type: "process", link_id: 9 });
    expect(router.push).toHaveBeenCalledWith({
      name: "process_detail",
      params: { process_id: 9 },
      query: { highlight: 9 },
    });
  });

  test("navigateToNotificationTarget routes document links with highlight", () => {
    const store = useNotificationStore();
    const router = { push: jest.fn() };
    store.navigateToNotificationTarget(router, { link_type: "document", link_id: 8 });
    expect(router.push).toHaveBeenCalledWith({
      name: "dynamic_document_dashboard",
      query: { highlight: 8 },
    });
  });

  test("navigateToNotificationTarget routes service_request links with highlight", () => {
    const store = useNotificationStore();
    const router = { push: jest.fn() };
    store.navigateToNotificationTarget(router, { link_type: "service_request", link_id: 7 });
    expect(router.push).toHaveBeenCalledWith({
      name: "service_request_detail",
      params: { id: 7 },
      query: { highlight: 7 },
    });
  });

  test("navigateToNotificationTarget falls back to notifications when link_id is missing", () => {
    const store = useNotificationStore();
    const router = { push: jest.fn() };
    store.navigateToNotificationTarget(router, { link_type: "process", link_id: null });
    expect(router.push).toHaveBeenCalledWith({ name: "notifications" });
  });

  test("navigateToNotificationTarget falls back to notifications for unknown link_type", () => {
    const store = useNotificationStore();
    const router = { push: jest.fn() };
    store.navigateToNotificationTarget(router, { link_type: "unknown", link_id: 1 });
    expect(router.push).toHaveBeenCalledWith({ name: "notifications" });
  });
});
