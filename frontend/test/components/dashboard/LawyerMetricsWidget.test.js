import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import LawyerMetricsWidget from "@/components/dashboard/widgets/LawyerMetricsWidget.vue";
import { useUserStore } from "@/stores/auth/user";

const mountWidget = () =>
  mount(LawyerMetricsWidget, {
    global: {
      stubs: {
        UserGroupIcon: { template: "<span />" },
        ArchiveBoxIcon: { template: "<span />" },
      },
    },
  });

describe("LawyerMetricsWidget.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("counts active and archived lawyers from the store", () => {
    const store = useUserStore();
    store.$patch({
      users: [
        { id: 1, role: "lawyer" },
        { id: 2, role: "lawyer" },
        { id: 3, role: "lawyer", is_archived: true },
        { id: 4, role: "client" },
      ],
    });

    const wrapper = mountWidget();

    expect(wrapper.find("[data-testid='active-lawyers-count']").text()).toBe("2");
    expect(wrapper.find("[data-testid='archived-lawyers-count']").text()).toBe("1");
  });
});
