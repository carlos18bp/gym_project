import { mount } from "@vue/test-utils";

import Bubbles from "@/components/process/Bubbles.vue";

describe("Bubbles.vue", () => {
  test("renders three bubbles and highlights history", () => {
    const wrapper = mount(Bubbles, {
      props: {
        length: 3,
        displayParam: "history",
      },
    });

    const bubbles = wrapper.findAll(".rounded-full");
    expect(bubbles).toHaveLength(3);
    expect(bubbles[2].classes()).toContain("bg-secondary");
  });

  test("renders single bubble for length 1", () => {
    const wrapper = mount(Bubbles, {
      props: {
        length: 1,
        displayParam: "current",
      },
    });

    expect(wrapper.findAll(".rounded-full")).toHaveLength(1);
  });
});
