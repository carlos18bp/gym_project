import { mount } from "@vue/test-utils";

import ClassificationBadge from "@/components/secop/ClassificationBadge.vue";

describe("ClassificationBadge.vue", () => {
  test("renders INTERESTING label and styling", () => {
    const wrapper = mount(ClassificationBadge, {
      props: { status: "INTERESTING" },
    });

    expect(wrapper.text()).toContain("Interesante");
    expect(wrapper.attributes("data-testid")).toBe("classification-badge-INTERESTING");
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["bg-blue-50", "text-blue-700"])
    );
  });

  test("renders UNDER_REVIEW label and styling", () => {
    const wrapper = mount(ClassificationBadge, {
      props: { status: "UNDER_REVIEW" },
    });

    expect(wrapper.text()).toContain("En Revisión");
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["bg-amber-50", "text-amber-700"])
    );
  });

  test("renders DISCARDED label and styling", () => {
    const wrapper = mount(ClassificationBadge, {
      props: { status: "DISCARDED" },
    });

    expect(wrapper.text()).toContain("Descartado");
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["bg-gray-50", "text-gray-600"])
    );
  });

  test("renders APPLIED label and styling", () => {
    const wrapper = mount(ClassificationBadge, {
      props: { status: "APPLIED" },
    });

    expect(wrapper.text()).toContain("Aplicado");
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["bg-green-50", "text-green-700"])
    );
  });

  test("renders fallback for unknown status", () => {
    const wrapper = mount(ClassificationBadge, {
      props: { status: "UNKNOWN" },
    });

    expect(wrapper.text()).toContain("UNKNOWN");
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["bg-gray-50", "text-gray-600"])
    );
  });
});
