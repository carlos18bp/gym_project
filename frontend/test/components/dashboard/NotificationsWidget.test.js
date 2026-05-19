import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import { useNotificationStore } from "@/stores/notification";

import NotificationsWidget from "@/components/dashboard/widgets/NotificationsWidget.vue";

// quality: allow-test-too-long (component test exercising store integration)

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: jest.fn() }),
}));

const flushPromises = async () => { await Promise.resolve(); };

const makeNotification = (id) => ({
  id,
  title: `Notification ${id}`,
  message: `Message ${id}`,
  is_read: false,
  link_type: "process",
  link_id: id,
  created_at: new Date().toISOString(),
});

describe("NotificationsWidget.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders empty state when there are no notifications", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useNotificationStore();
    jest.spyOn(store, "fetchUnreadCount").mockResolvedValue();
    jest.spyOn(store, "fetchNotifications").mockResolvedValue();
    store.$patch({ notifications: [], unreadCount: 0, dataLoaded: true });

    const wrapper = mount(NotificationsWidget, {
      props: { user: { id: 1, role: "client" } },
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Sin notificaciones recientes");
    expect(wrapper.find("[data-testid='notifications-widget-list']").exists()).toBe(false);
  });

  test("renders the widgetNotifications slice (up to 10 items)", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useNotificationStore();
    jest.spyOn(store, "fetchUnreadCount").mockResolvedValue();
    jest.spyOn(store, "fetchNotifications").mockResolvedValue();
    // 15 notifications loaded in the store; widget should only render 10.
    const notifications = Array.from({ length: 15 }, (_, i) => makeNotification(i + 1));
    store.$patch({ notifications, unreadCount: 15, dataLoaded: true });

    const wrapper = mount(NotificationsWidget, {
      props: { user: { id: 1, role: "client" } },
      global: { plugins: [pinia] },
    });
    await flushPromises();

    const items = wrapper.findAll("[data-testid='notifications-widget-list'] li");
    expect(items).toHaveLength(10);
  });

  test("widget list has max-height + overflow classes to enable scrolling", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useNotificationStore();
    jest.spyOn(store, "fetchUnreadCount").mockResolvedValue();
    jest.spyOn(store, "fetchNotifications").mockResolvedValue();
    store.$patch({
      notifications: Array.from({ length: 5 }, (_, i) => makeNotification(i + 1)),
      unreadCount: 5,
      dataLoaded: true,
    });

    const wrapper = mount(NotificationsWidget, {
      props: { user: { id: 1, role: "client" } },
      global: { plugins: [pinia] },
    });
    await flushPromises();

    const list = wrapper.find("[data-testid='notifications-widget-list']");
    expect(list.exists()).toBe(true);
    const cls = list.attributes("class") || "";
    expect(cls).toContain("overflow-y-auto");
    expect(cls).toContain("max-h-");
  });

  test("clicking an item invokes the store's navigation helper with the clicked notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useNotificationStore();
    jest.spyOn(store, "fetchUnreadCount").mockResolvedValue();
    jest.spyOn(store, "fetchNotifications").mockResolvedValue();
    const navSpy = jest
      .spyOn(store, "navigateToNotificationTarget")
      .mockImplementation(() => {});
    const notif = makeNotification(42);
    store.$patch({ notifications: [notif], unreadCount: 1, dataLoaded: true });

    const wrapper = mount(NotificationsWidget, {
      props: { user: { id: 1, role: "client" } },
      global: { plugins: [pinia] },
    });
    await flushPromises();

    await wrapper.find("[data-testid='notifications-widget-list'] li").trigger("click");

    expect(navSpy).toHaveBeenCalledTimes(1);
    expect(navSpy.mock.calls[0][1]).toEqual(notif);
  });

  test("unread count footer shows the store unreadCount", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useNotificationStore();
    jest.spyOn(store, "fetchUnreadCount").mockResolvedValue();
    jest.spyOn(store, "fetchNotifications").mockResolvedValue();
    store.$patch({
      notifications: [makeNotification(1)],
      unreadCount: 7,
      dataLoaded: true,
    });

    const wrapper = mount(NotificationsWidget, {
      props: { user: { id: 1, role: "client" } },
      global: { plugins: [pinia] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("7 sin leer");
  });
});
