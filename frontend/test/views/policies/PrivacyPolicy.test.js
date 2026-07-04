import { mount } from "@vue/test-utils";

import PrivacyPolicy from "@/views/policies/PrivacyPolicy.vue";

const RouterLinkStub = { name: "RouterLink", props: ["to"], template: "<a><slot /></a>" };
const stubs = { RouterLink: RouterLinkStub, XMarkIcon: { template: "<span data-testid='x-icon' />" } };

describe("views/policies/PrivacyPolicy.vue", () => {
  const mountView = () => mount(PrivacyPolicy, { global: { stubs } });

  test("renders the privacy policy heading", () => {
    const wrapper = mountView();

    expect(wrapper.get("h1").text()).toBe("Política de Privacidad");
  });

  test("offers a back link to the sign-in route", () => {
    const wrapper = mountView();

    const links = wrapper.findAllComponents(RouterLinkStub);
    expect(links.some((l) => l.props("to")?.name === "sign_in")).toBe(true);
  });
});
