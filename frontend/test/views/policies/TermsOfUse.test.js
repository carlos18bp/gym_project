import { mount } from "@vue/test-utils";

import TermsOfUse from "@/views/policies/TermsOfUse.vue";

const RouterLinkStub = { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" };
const stubs = { RouterLink: RouterLinkStub, XMarkIcon: { template: "<span data-testid='x-icon' />" } };

describe("views/policies/TermsOfUse.vue", () => {
  const mountView = () => mount(TermsOfUse, { global: { stubs } });

  test("renders the terms and conditions heading", () => {
    const wrapper = mountView();

    expect(wrapper.get("h1").text()).toBe("Términos y Condiciones");
  });

  test("offers a back link to the sign-in route", () => {
    const wrapper = mountView();

    const links = wrapper.findAllComponents(RouterLinkStub);
    expect(links.some((l) => l.props("to")?.name === "sign_in")).toBe(true);
  });
});
