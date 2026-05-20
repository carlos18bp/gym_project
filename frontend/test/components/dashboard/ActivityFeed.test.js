import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import ActivityFeed from "@/components/dashboard/ActivityFeed.vue";

const flushPromises = async () => {
  await Promise.resolve();
};

const findButtonByText = (wrapper, text) => {
  const btn = wrapper
    .findAll("button")
    .find((b) => (b.text() || "").trim() === text);
  if (!btn) {
    throw new Error(`Button not found: ${text}`);
  }
  return btn;
};

describe("ActivityFeed.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("renders Feed and Contacts tabs for non-lawyer and does not show Reports tab", async () => {
    const wrapper = mount(ActivityFeed, {
      props: {
        user: { id: 1, role: "client" },
      },
      global: {
        stubs: {
          NotificationsWidget: { template: "<div data-test='notifications-widget' />" },
          FeedWidget: { template: "<div data-test='feed-widget' />" },
          ContactsWidget: { template: "<div data-test='contacts-widget' />" },
          ReportsWidget: { template: "<div data-test='reports-widget' />" },
        },
      },
    });

    expect(wrapper.text()).toContain("Feed");
    expect(wrapper.text()).toContain("Abogados");
    expect(wrapper.text()).not.toContain("Reportes");

    // Default tab is notifications
    expect(wrapper.find("[data-test='notifications-widget']").exists()).toBe(true);
    expect(wrapper.find("[data-test='feed-widget']").exists()).toBe(false);
    expect(wrapper.find("[data-test='contacts-widget']").exists()).toBe(false);
  });

  test("switches between Feed and Contacts tabs", async () => {
    const wrapper = mount(ActivityFeed, {
      props: {
        user: { id: 1, role: "client" },
      },
      global: {
        stubs: {
          NotificationsWidget: { template: "<div data-test='notifications-widget' />" },
          FeedWidget: { template: "<div data-test='feed-widget' />" },
          ContactsWidget: { template: "<div data-test='contacts-widget' />" },
          ReportsWidget: { template: "<div data-test='reports-widget' />" },
        },
      },
    });

    await findButtonByText(wrapper, "Abogados").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='feed-widget']").exists()).toBe(false);
    expect(wrapper.find("[data-test='contacts-widget']").exists()).toBe(true);

    await findButtonByText(wrapper, "Feed").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='feed-widget']").exists()).toBe(true);
    expect(wrapper.find("[data-test='contacts-widget']").exists()).toBe(false);
  });

  test("shows Reports tab for lawyers and resets to Feed if role changes while reports is active", async () => {
    const wrapper = mount(ActivityFeed, {
      props: {
        user: { id: 1, role: "lawyer" },
      },
      global: {
        stubs: {
          NotificationsWidget: { template: "<div data-test='notifications-widget' />" },
          FeedWidget: { template: "<div data-test='feed-widget' />" },
          ContactsWidget: { template: "<div data-test='contacts-widget' />" },
          ReportsWidget: { template: "<div data-test='reports-widget' />" },
        },
      },
    });

    expect(wrapper.text()).toContain("Reportes");
    expect(wrapper.text()).toContain("Contactos");

    await findButtonByText(wrapper, "Reportes").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='reports-widget']").exists()).toBe(true);

    await wrapper.setProps({ user: { id: 1, role: "client" } });
    await flushPromises();

    // Watch should reset activeTab to 'notifications'
    expect(wrapper.find("[data-test='notifications-widget']").exists()).toBe(true);
    expect(wrapper.find("[data-test='reports-widget']").exists()).toBe(false);
  });

  test.each([
    ["admin role", { role: "admin" }],
    ["is_staff", { role: "client", is_staff: true }],
    ["is_superuser", { role: "client", is_superuser: true }],
  ])("shows Reports tab for %s users", async (_label, userOverrides) => {
    const wrapper = mount(ActivityFeed, {
      props: {
        user: { id: 1, ...userOverrides },
      },
      global: {
        stubs: {
          NotificationsWidget: { template: "<div data-test='notifications-widget' />" },
          FeedWidget: { template: "<div data-test='feed-widget' />" },
          ContactsWidget: { template: "<div data-test='contacts-widget' />" },
          ReportsWidget: { template: "<div data-test='reports-widget' />" },
        },
      },
    });

    expect(wrapper.text()).toContain("Reportes");

    await findButtonByText(wrapper, "Reportes").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='reports-widget']").exists()).toBe(true);
  });
});
