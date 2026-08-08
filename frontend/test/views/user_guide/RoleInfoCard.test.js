import { mount } from "@vue/test-utils";

const mockGetModulesForRole = jest.fn();

jest.mock("@/stores/user_guide", () => ({
  useUserGuideStore: () => ({
    getModulesForRole: mockGetModulesForRole,
  }),
}));

import RoleInfoCard from "@/views/user_guide/components/RoleInfoCard.vue";

const mountCard = (role) => mount(RoleInfoCard, { props: { role } });

describe("views/user_guide/components/RoleInfoCard.vue", () => {
  beforeEach(() => {
    mockGetModulesForRole.mockReset();
    mockGetModulesForRole.mockReturnValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  test.each([
    ["lawyer", "Abogado"],
    ["client", "Cliente"],
    ["corporate_client", "Cliente Corporativo"],
    ["basic", "Usuario Básico"],
  ])("shows the human role name for %s", (role, expected) => {
    const wrapper = mountCard(role);

    expect(wrapper.text()).toContain(expected);
  });

  test("falls back to the raw role string for unknown roles", () => {
    const wrapper = mountCard("auditor");

    expect(wrapper.text()).toContain("auditor");
  });

  test("shows the role description for a known role", () => {
    const wrapper = mountCard("lawyer");

    expect(wrapper.text()).toContain("acceso completo a todas las funcionalidades");
  });

  test("shows the module count reported by the user guide store", () => {
    const wrapper = mountCard("client");

    expect(mockGetModulesForRole).toHaveBeenCalledWith("client");
    expect(wrapper.text()).toContain("3 módulos disponibles");
  });

  test.each([
    ["lawyer", "completas"],
    ["basic", "básicas"],
  ])("shows the access level for %s", (role, level) => {
    const wrapper = mountCard(role);

    expect(wrapper.text()).toContain(`funcionalidades ${level}`);
  });

  test("falls back to the limited access level for unknown roles", () => {
    const wrapper = mountCard("auditor");

    expect(wrapper.text()).toContain("funcionalidades limitadas");
  });
});
