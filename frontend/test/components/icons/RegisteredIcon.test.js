import { mount } from "@vue/test-utils";

import RegisteredIcon from "@/components/icons/RegisteredIcon.vue";

describe("components/icons/RegisteredIcon.vue", () => {
  test("renders an svg element", () => {
    const wrapper = mount(RegisteredIcon);

    expect(wrapper.find("svg").exists()).toBe(true);
  });

  test("forwards attributes to the svg root", () => {
    const wrapper = mount(RegisteredIcon, { attrs: { "aria-label": "Registrado" } });

    expect(wrapper.find("svg").attributes("aria-label")).toBe("Registrado");
  });
});
