import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import { useNotificationStore } from "@/stores/notification";
import NotificationSummaryCard from "@/components/dashboard/NotificationSummaryCard.vue";

const TEST_DATE = "2026-01-15T10:00:00.000Z";

jest.mock("@heroicons/vue/24/solid", () => ({
  __esModule: true,
  BellAlertIcon: { name: "BellAlertIcon", template: "<svg />" },
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
  store.$patch({
    notifications: [],
    unreadCount: 0,
    dataLoaded: true,
    ...overrides,
  });
  return store;
};

const mountCard = () =>
  mount(NotificationSummaryCard, {
    global: {
      stubs: {
        "router-link": {
          props: ["to"],
          template: "<a data-testid='see-all' :data-to='JSON.stringify(to)'><slot /></a>",
        },
      },
    },
  });

describe("NotificationSummaryCard.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  test("hides the unread badge when count is 0", async () => {
    buildStore({ unreadCount: 0 });

    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.text()).not.toMatch(/^\s*\d+\s*$/m);
  });

  test("shows the unread badge with the count when greater than 0", async () => {
    buildStore({ unreadCount: 7 });

    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.text()).toContain("7");
  });

  test("displays 99+ for unread counts above 99", async () => {
    buildStore({ unreadCount: 250 });

    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.text()).toContain("99+");
  });

  test("shows empty state when there are no notifications", async () => {
    buildStore({ notifications: [] });

    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.text()).toContain("Sin notificaciones recientes");
  });

  test("renders only the latest 3 notifications", async () => {
    buildStore({
      notifications: [
        { id: 1, title: "One", message: "m", is_read: false, created_at: TEST_DATE },
        { id: 2, title: "Two", message: "m", is_read: true, created_at: TEST_DATE },
        { id: 3, title: "Three", message: "m", is_read: true, created_at: TEST_DATE },
        { id: 4, title: "Four", message: "m", is_read: true, created_at: TEST_DATE },
      ],
    });

    const wrapper = mountCard();
    await flushPromises();

    expect(wrapper.text()).toContain("One");
    expect(wrapper.text()).toContain("Two");
    expect(wrapper.text()).toContain("Three");
    expect(wrapper.text()).not.toContain("Four");
  });

  test("clicking a process notification navigates with highlight query param", async () => {
    buildStore({
      notifications: [
        { id: 21, title: "P", message: "m", is_read: true, link_type: "process", link_id: 9, created_at: TEST_DATE },
      ],
    });

    const wrapper = mountCard();
    await flushPromises();

    await wrapper.findAll("[class*='cursor-pointer']")[0].trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "process_detail",
      params: { process_id: 9 },
      query: { highlight: 9 },
    });
  });

  test("clicking a document notification navigates with highlight query param", async () => {
    buildStore({
      notifications: [
        { id: 22, title: "D", message: "m", is_read: true, link_type: "document", link_id: 8, created_at: TEST_DATE },
      ],
    });

    const wrapper = mountCard();
    await flushPromises();

    await wrapper.findAll("[class*='cursor-pointer']")[0].trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "dynamic_document_dashboard",
      query: { highlight: 8 },
    });
  });

  test("clicking a service_request notification navigates with highlight query param", async () => {
    buildStore({
      notifications: [
        { id: 23, title: "S", message: "m", is_read: true, link_type: "service_request", link_id: 7, created_at: TEST_DATE },
      ],
    });

    const wrapper = mountCard();
    await flushPromises();

    await wrapper.findAll("[class*='cursor-pointer']")[0].trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "service_request_detail",
      params: { id: 7 },
      query: { highlight: 7 },
    });
  });

  test("clicking a notification without link_type falls back to notifications route", async () => {
    buildStore({
      notifications: [
        { id: 24, title: "X", message: "m", is_read: true, link_type: "", link_id: null, created_at: TEST_DATE },
      ],
    });

    const wrapper = mountCard();
    await flushPromises();

    await wrapper.findAll("[class*='cursor-pointer']")[0].trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({ name: "notifications" });
  });

  test("'Ver todas' link points to the notifications route", async () => {
    buildStore();

    const wrapper = mountCard();
    await flushPromises();

    const link = wrapper.find("[data-testid='see-all']");
    expect(link.exists()).toBe(true);
    expect(JSON.parse(link.attributes("data-to"))).toEqual({ name: "notifications" });
  });
});
