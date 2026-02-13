import { mount } from "@vue/test-utils";

import StatusBadge from "@/components/legal-requests/StatusBadge.vue";

jest.mock("@heroicons/vue/24/solid", () => ({
  __esModule: true,
  ClockIcon: { name: "ClockIcon", template: "<span />" },
  EyeIcon: { name: "EyeIcon", template: "<span />" },
  CheckCircleIcon: { name: "CheckCircleIcon", template: "<span />" },
  XCircleIcon: { name: "XCircleIcon", template: "<span />" },
}));

describe("StatusBadge.vue", () => {
  test("renders pending status config", () => {
    const wrapper = mount(StatusBadge, {
      props: {
        status: "PENDING",
      },
    });

    expect(wrapper.text()).toContain("Pendiente");
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["bg-yellow-100", "text-yellow-800"])
    );
  });

  test("falls back for unknown status", () => {
    const wrapper = mount(StatusBadge, {
      props: {
        status: "CUSTOM",
      },
    });

    expect(wrapper.text()).toContain("CUSTOM");
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["bg-gray-100", "text-gray-800"])
    );
  });
});
