import { mount } from "@vue/test-utils";

import Home from "@/views/policies/Home.vue";

const RouterLinkStub = { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" };

describe("views/policies/Home.vue", () => {
  const mountHome = () => mount(Home, { global: { stubs: { RouterLink: RouterLinkStub } } });

  test("renders the welcome heading", () => {
    const wrapper = mountHome();

    expect(wrapper.get("h1").text()).toContain("Bienvenido a G&M Platform");
  });

  test("links to the sign-in route", () => {
    const wrapper = mountHome();

    const links = wrapper.findAllComponents(RouterLinkStub);
    expect(links.some((l) => l.props("to")?.name === "sign_in")).toBe(true);
  });
});
