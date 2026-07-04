import { mount } from "@vue/test-utils";

import TabsCard from "@/components/layouts/TabsCard.vue";

describe("components/layouts/TabsCard.vue", () => {
  test("renders slotted content", () => {
    const wrapper = mount(TabsCard, {
      slots: { default: "<p data-testid='inner'>tab content</p>" },
    });

    expect(wrapper.find("[data-testid='inner']").text()).toBe("tab content");
  });

  test("uses the default testid on the card root", () => {
    const wrapper = mount(TabsCard);

    expect(wrapper.find("[data-testid='tabs-card']").exists()).toBe(true);
  });

  test("applies a custom testid on the card root", () => {
    const wrapper = mount(TabsCard, { props: { testid: "secop-tabs" } });

    expect(wrapper.find("[data-testid='secop-tabs']").exists()).toBe(true);
  });
});
