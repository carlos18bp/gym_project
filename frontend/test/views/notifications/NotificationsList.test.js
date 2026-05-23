import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import { useNotificationStore } from "@/stores/notification";
import NotificationsList from "@/views/notifications/NotificationsList.vue";

const TEST_DATE = "2026-01-15T10:00:00.000Z";

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  CheckIcon: { name: "CheckIcon", template: "<svg />" },
  ClockIcon: { name: "ClockIcon", template: "<svg />" },
  ArchiveBoxIcon: { name: "ArchiveBoxIcon", template: "<svg />" },
  TrashIcon: { name: "TrashIcon", template: "<svg />" },
  BellIcon: { name: "BellIcon", template: "<svg />" },
}));

jest.mock("@heroicons/vue/24/solid", () => ({
  __esModule: true,
  BellAlertIcon: { name: "BellAlertIcon", template: "<svg />" },
  DocumentTextIcon: { name: "DocumentTextIcon", template: "<svg />" },
  RectangleStackIcon: { name: "RectangleStackIcon", template: "<svg />" },
  InboxIcon: { name: "InboxIcon", template: "<svg />" },
}));

const mockRouterPush = jest.fn();

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const buildStore = (overrides = {}) => {
  const store = useNotificationStore();
  store.fetchNotifications = jest.fn().mockResolvedValue();
  store.fetchUnreadCount = jest.fn().mockResolvedValue();
  store.markAsRead = jest.fn().mockResolvedValue();
  store.markAllRead = jest.fn().mockResolvedValue(0);
  store.archiveNotification = jest.fn().mockResolvedValue();
  store.snoozeNotification = jest.fn().mockResolvedValue();
  store.deleteNotification = jest.fn().mockResolvedValue();
  store.$patch({
    notifications: [],
    totalCount: 0,
    unreadCount: 0,
    currentTab: "all",
    currentPage: 1,
    pageSize: 20,
    dataLoaded: true,
    ...overrides,
  });
  return store;
};

describe("NotificationsList.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  test("renders two filter tabs", async () => {
    buildStore();

    const wrapper = mount(NotificationsList);
    await flushPromises();

    expect(wrapper.find("[data-testid='tab-all']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='tab-archived']").exists()).toBe(true);
  });

  test("shows empty state when there are no notifications", async () => {
    buildStore({ dataLoaded: true, notifications: [] });

    const wrapper = mount(NotificationsList);
    await flushPromises();

    expect(wrapper.find("[data-testid='empty-state']").exists()).toBe(true);
  });

  test("renders a list item per notification", async () => {
    buildStore({
      notifications: [
        { id: 1, title: "A", message: "msg", category: "general", priority: "medium", is_read: true, created_at: TEST_DATE },
        { id: 2, title: "B", message: "msg", category: "process_alert", priority: "high", is_read: false, created_at: TEST_DATE },
      ],
      totalCount: 2,
    });

    const wrapper = mount(NotificationsList);
    await flushPromises();

    expect(wrapper.find("[data-testid='notification-1']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='notification-2']").exists()).toBe(true);
  });

  test("switching tab calls fetchNotifications with the new tab key", async () => {
    const store = buildStore();

    const wrapper = mount(NotificationsList);
    await flushPromises();

    store.fetchNotifications.mockClear();

    await wrapper.find("[data-testid='tab-archived']").trigger("click");

    expect(store.fetchNotifications).toHaveBeenCalledWith("archived", 1);
  });

  test("clicking a process notification navigates with highlight query param", async () => {
    const store = buildStore({
      notifications: [
        { id: 11, title: "p", message: "m", category: "process_alert", priority: "low", is_read: true, link_type: "process", link_id: 99, created_at: TEST_DATE },
      ],
      totalCount: 1,
    });

    const wrapper = mount(NotificationsList);
    await flushPromises();

    await wrapper.find("[data-testid='notification-11']").trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "process_detail",
      params: { process_id: 99 },
      query: { highlight: 99 },
    });
    expect(store.markAsRead).not.toHaveBeenCalled();
  });

  test("clicking a document notification navigates with highlight query param", async () => {
    buildStore({
      notifications: [
        { id: 12, title: "d", message: "m", category: "signature_request", priority: "low", is_read: true, link_type: "document", link_id: 77, created_at: TEST_DATE },
      ],
      totalCount: 1,
    });

    const wrapper = mount(NotificationsList);
    await flushPromises();

    await wrapper.find("[data-testid='notification-12']").trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "dynamic_document_dashboard",
      query: { highlight: 77 },
    });
  });

  test("clicking a service_request notification navigates with highlight query param", async () => {
    buildStore({
      notifications: [
        { id: 13, title: "s", message: "m", category: "general", priority: "low", is_read: true, link_type: "service_request", link_id: 55, created_at: TEST_DATE },
      ],
      totalCount: 1,
    });

    const wrapper = mount(NotificationsList);
    await flushPromises();

    await wrapper.find("[data-testid='notification-13']").trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "service_request_detail",
      params: { id: 55 },
      query: { highlight: 55 },
    });
  });

  test("clicking an unread notification marks it as read before navigating", async () => {
    const store = buildStore({
      notifications: [
        { id: 14, title: "x", message: "m", category: "general", priority: "low", is_read: false, link_type: "process", link_id: 1, created_at: TEST_DATE },
      ],
      totalCount: 1,
    });

    const wrapper = mount(NotificationsList);
    await flushPromises();

    await wrapper.find("[data-testid='notification-14']").trigger("click");

    expect(store.markAsRead).toHaveBeenCalledWith(14);
  });

  test("mark-all-read button is hidden when there are no unread notifications", async () => {
    buildStore({ unreadCount: 0 });

    const wrapper = mount(NotificationsList);
    await flushPromises();

    expect(wrapper.find("[data-testid='mark-all-read-btn']").exists()).toBe(false);
  });

  test("mark-all-read button calls markAllRead and refetches", async () => {
    const store = buildStore({ unreadCount: 3 });

    const wrapper = mount(NotificationsList);
    await flushPromises();

    await wrapper.find("[data-testid='mark-all-read-btn']").trigger("click");
    await flushPromises();

    expect(store.markAllRead).toHaveBeenCalled();
  });

  test("pagination controls render only when there is more than one page", async () => {
    buildStore({
      totalCount: 50,
      pageSize: 20,
      currentPage: 1,
      notifications: [
        { id: 1, title: "A", message: "m", category: "general", priority: "low", is_read: true, created_at: TEST_DATE },
      ],
    });

    const wrapper = mount(NotificationsList);
    await flushPromises();

    expect(wrapper.text()).toContain("Página 1 de 3");
  });
});
