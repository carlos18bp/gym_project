import { mount } from "@vue/test-utils";

import NoConnection from "@/views/offline/NoConnection.vue";

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  GlobeAmericasIcon: { name: "GlobeAmericasIcon", template: "<span data-test='globe-icon' />" },
}));

describe("views/offline/NoConnection.vue", () => {
  test("renders the offline heading", () => {
    const wrapper = mount(NoConnection);

    expect(wrapper.text()).toContain("¡Parece que no hay internet!");
  });

  test("renders the guidance to check the connection", () => {
    const wrapper = mount(NoConnection);

    expect(wrapper.text()).toContain("Revisa tu conexión para seguir navegando.");
  });

  test("renders the globe illustration", () => {
    const wrapper = mount(NoConnection);

    expect(wrapper.find("[data-test='globe-icon']").exists()).toBe(true);
  });
});
