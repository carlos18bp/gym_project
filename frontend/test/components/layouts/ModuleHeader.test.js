import { mount } from "@vue/test-utils";

import ModuleHeader from "@/components/layouts/ModuleHeader.vue";

describe("components/layouts/ModuleHeader.vue", () => {
  test("renders the title", () => {
    const wrapper = mount(ModuleHeader, { props: { title: "Procesos" } });

    expect(wrapper.find("[data-testid='module-header-title']").text()).toBe("Procesos");
  });

  test("renders the subtitle when provided", () => {
    const wrapper = mount(ModuleHeader, {
      props: { title: "Procesos", subtitle: "Gestión de casos" },
    });

    expect(wrapper.text()).toContain("Gestión de casos");
  });

  test("omits the subtitle paragraph when not provided", () => {
    const wrapper = mount(ModuleHeader, { props: { title: "Procesos" } });

    expect(wrapper.findAll("p")).toHaveLength(0);
  });

  test("renders the actions slot", () => {
    const wrapper = mount(ModuleHeader, {
      props: { title: "Procesos" },
      slots: { actions: "<button data-testid='action'>Nuevo</button>" },
    });

    expect(wrapper.find("[data-testid='action']").exists()).toBe(true);
  });

  test("renders the menu-button slot", () => {
    const wrapper = mount(ModuleHeader, {
      props: { title: "Procesos" },
      slots: { "menu-button": "<button data-testid='menu'>Menu</button>" },
    });

    expect(wrapper.find("[data-testid='menu']").exists()).toBe(true);
  });
});
