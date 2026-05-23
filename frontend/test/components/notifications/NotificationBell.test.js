import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import { useNotificationStore } from "@/stores/notification";
import NotificationBell from "@/components/notifications/NotificationBell.vue";

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  BellIcon: { name: "BellIcon", template: "<svg />" },
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
};

describe("NotificationBell.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  const mountBell = () =>
    mount(NotificationBell, {
      global: {
        stubs: {
          BellIcon: { template: "<svg data-testid='bell-icon' />" },
        },
      },
    });

  test("renders the bell button", () => {
    const store = useNotificationStore();
    store.startPolling = jest.fn();
    store.stopPolling = jest.fn();

    const wrapper = mountBell();

    expect(wrapper.find("[data-testid='notification-bell']").exists()).toBe(true);
  });

  test("hides badge when unreadCount is 0", () => {
    const store = useNotificationStore();
    store.startPolling = jest.fn();
    store.stopPolling = jest.fn();
    store.$patch({ unreadCount: 0 });

    const wrapper = mountBell();

    expect(wrapper.find("[data-testid='notification-badge']").exists()).toBe(false);
  });

  test("shows badge with unread count when greater than 0", () => {
    const store = useNotificationStore();
    store.startPolling = jest.fn();
    store.stopPolling = jest.fn();
    store.$patch({ unreadCount: 5 });

    const wrapper = mountBell();

    const badge = wrapper.find("[data-testid='notification-badge']");
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe("5");
  });

  test("displays 99+ for counts above 99", () => {
    const store = useNotificationStore();
    store.startPolling = jest.fn();
    store.stopPolling = jest.fn();
    store.$patch({ unreadCount: 150 });

    const wrapper = mountBell();

    expect(wrapper.find("[data-testid='notification-badge']").text()).toBe("99+");
  });

  test("navigates to notifications route on click", async () => {
    const store = useNotificationStore();
    store.startPolling = jest.fn();
    store.stopPolling = jest.fn();

    const wrapper = mountBell();

    await wrapper.find("[data-testid='notification-bell']").trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({ name: "notifications" });
  });

  test("starts polling on mount", () => {
    const store = useNotificationStore();
    store.startPolling = jest.fn();
    store.stopPolling = jest.fn();

    mountBell();

    expect(store.startPolling).toHaveBeenCalled();
  });

  test("stops polling on unmount", async () => {
    const store = useNotificationStore();
    store.startPolling = jest.fn();
    store.stopPolling = jest.fn();

    const wrapper = mountBell();
    wrapper.unmount();
    await flushPromises();

    expect(store.stopPolling).toHaveBeenCalled();
  });
});
