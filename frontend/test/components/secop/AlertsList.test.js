import { mount } from "@vue/test-utils";

import AlertsList from "@/components/secop/AlertsList.vue";

describe("AlertsList.vue", () => {
  test("renders empty state when no alerts", () => {
    const wrapper = mount(AlertsList, {
      props: { alerts: [] },
    });

    expect(wrapper.text()).toContain("Sin alertas configuradas");
  });

  test("renders alert cards with name and frequency", () => {
    const wrapper = mount(AlertsList, {
      props: {
        alerts: [
          { id: 1, name: "Alert One", is_active: true, frequency: "DAILY", notification_count: 3 },
          { id: 2, name: "Alert Two", is_active: false, frequency: "WEEKLY", notification_count: 0 },
        ],
      },
    });

    expect(wrapper.text()).toContain("Alert One");
    expect(wrapper.text()).toContain("Alert Two");
  });

  test("emits toggle event with alert id", async () => {
    const wrapper = mount(AlertsList, {
      props: {
        alerts: [
          { id: 1, name: "Toggle Me", is_active: true, frequency: "DAILY", notification_count: 0 },
        ],
      },
    });

    await wrapper.find("[data-testid='alert-toggle-1']").trigger("click");

    expect(wrapper.emitted("toggle")).toHaveLength(1);
    expect(wrapper.emitted("toggle")[0]).toEqual([1]);
  });

  test("emits delete event with alert id", async () => {
    const wrapper = mount(AlertsList, {
      props: {
        alerts: [
          { id: 1, name: "Delete Me", is_active: true, frequency: "DAILY", notification_count: 0 },
        ],
      },
    });

    await wrapper.find("[data-testid='alert-delete-1']").trigger("click");

    expect(wrapper.emitted("delete")).toHaveLength(1);
    expect(wrapper.emitted("delete")[0]).toEqual([1]);
  });
});
