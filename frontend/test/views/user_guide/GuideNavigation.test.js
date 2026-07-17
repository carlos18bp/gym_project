import { mount } from "@vue/test-utils";

const mockGetModulesForRole = jest.fn();

jest.mock("@/stores/user_guide", () => ({
  useUserGuideStore: () => ({
    getModulesForRole: mockGetModulesForRole,
  }),
}));

import GuideNavigation from "@/views/user_guide/components/GuideNavigation.vue";

const IconStub = { template: "<svg />" };

const modulesFixture = [
  {
    id: "dashboard",
    name: "Panel Principal",
    icon: IconStub,
    sections: [
      { id: "overview", name: "Resumen" },
      { id: "reports", name: "Reportes" },
    ],
  },
  { id: "processes", name: "Procesos", icon: IconStub, sections: [] },
];

const mountNav = (props = {}) =>
  mount(GuideNavigation, {
    props: { currentRole: "lawyer", ...props },
  });

describe("views/user_guide/components/GuideNavigation.vue", () => {
  beforeEach(() => {
    mockGetModulesForRole.mockReset();
    mockGetModulesForRole.mockReturnValue(modulesFixture);
  });

  test("shows the human role name in the badge", () => {
    const wrapper = mountNav({ currentRole: "corporate_client" });

    expect(wrapper.text()).toContain("Cliente Corporativo");
  });

  test("falls back to the raw role string for unknown roles in the badge", () => {
    const wrapper = mountNav({ currentRole: "auditor" });

    expect(wrapper.text()).toContain("auditor");
  });

  test("lists every module returned by the store for the role", () => {
    const wrapper = mountNav();

    expect(mockGetModulesForRole).toHaveBeenCalledWith("lawyer");
    expect(wrapper.text()).toContain("Panel Principal");
    expect(wrapper.text()).toContain("Procesos");
  });

  test("emits module-selected with the module id when a module is clicked", async () => {
    const wrapper = mountNav();

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Panel Principal"))
      .trigger("click");

    expect(wrapper.emitted("module-selected")).toEqual([["dashboard"]]);
  });

  test("hides sections when the module is not selected", () => {
    const wrapper = mountNav({ selectedModule: null });

    expect(wrapper.text()).not.toContain("Resumen");
  });

  test("shows the sections of the selected module", () => {
    const wrapper = mountNav({ selectedModule: "dashboard" });

    expect(wrapper.text()).toContain("Resumen");
    expect(wrapper.text()).toContain("Reportes");
  });

  test("emits section-selected with the section id when a section is clicked", async () => {
    const wrapper = mountNav({ selectedModule: "dashboard" });

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Resumen")
      .trigger("click");

    expect(wrapper.emitted("section-selected")).toEqual([["overview"]]);
  });

  test("links to WhatsApp support from the help box", () => {
    const wrapper = mountNav();

    expect(wrapper.get("a").attributes("href")).toContain("api.whatsapp.com");
  });
});
