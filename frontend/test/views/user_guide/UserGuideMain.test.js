import { mount } from "@vue/test-utils";
import { ref, nextTick } from "vue";

const mockUserById = jest.fn();
const mockUserInit = jest.fn().mockResolvedValue(undefined);
jest.mock("@/stores/auth/user", () => ({
  useUserStore: () => ({ userById: mockUserById, init: mockUserInit }),
}));

let mockAuthStore;
jest.mock("@/stores/auth/auth", () => ({
  useAuthStore: () => mockAuthStore,
}));

const mockGetModulesForRole = jest.fn();
const mockInitializeGuideContent = jest.fn();
jest.mock("@/stores/user_guide", () => ({
  useUserGuideStore: () => ({
    getModulesForRole: mockGetModulesForRole,
    initializeGuideContent: mockInitializeGuideContent,
  }),
}));

let mockCurrentRoute;
jest.mock("vue-router", () => ({
  useRouter: () => ({ currentRoute: mockCurrentRoute, push: jest.fn() }),
}));

import UserGuideMain from "@/views/user_guide/UserGuideMain.vue";

const stubs = {
  ModuleHeader: { name: "ModuleHeader", props: ["title"], template: "<header><slot name='menu-button' /></header>" },
  GuideNavigation: {
    name: "GuideNavigation",
    props: ["currentRole", "selectedModule", "selectedSection"],
    emits: ["module-selected", "section-selected", "close"],
    template: "<nav data-testid='guide-nav' />",
  },
  ModuleGuide: {
    name: "ModuleGuide",
    props: ["module", "section", "role", "searchQuery"],
    emits: ["section-selected"],
    template: "<div data-testid='module-guide' />",
  },
  SearchGuide: {
    name: "SearchGuide",
    props: ["modelValue"],
    emits: ["update:modelValue", "search", "result-selected"],
    template: "<div data-testid='search-guide' />",
  },
  RoleInfoCard: { name: "RoleInfoCard", props: ["role"], template: "<div data-testid='role-card' />" },
  QuickLinksCard: {
    name: "QuickLinksCard",
    props: ["role"],
    emits: ["navigate"],
    template: "<div data-testid='quick-links' />",
  },
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const mountMain = async () => {
  const wrapper = mount(UserGuideMain, { global: { stubs } });
  await flushPromises();
  return wrapper;
};

describe("views/user_guide/UserGuideMain.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthStore = { userAuth: { id: 9 } };
    mockUserById.mockReturnValue({ id: 9, role: "client" });
    mockGetModulesForRole.mockReturnValue([{ id: "dashboard", name: "Panel Principal" }]);
    mockCurrentRoute = ref({ params: {} });
  });

  test("initializes the user store and guide content on mount", async () => {
    await mountMain();

    expect(mockUserInit).toHaveBeenCalledTimes(1);
    expect(mockInitializeGuideContent).toHaveBeenCalledTimes(1);
  });

  test("shows the welcome screen with role cards when no module is selected", async () => {
    const wrapper = await mountMain();

    expect(wrapper.text()).toContain("Bienvenido al Manual de Usuario");
    expect(wrapper.findComponent({ name: "RoleInfoCard" }).props("role")).toBe("client");
    expect(wrapper.findComponent({ name: "QuickLinksCard" }).props("role")).toBe("client");
  });

  test.each([
    [{ id: 9, role: "admin" }, "admin"],
    [{ id: 9, role: "client", is_staff: true }, "admin"],
    [{ id: 9, role: "lawyer", is_superuser: true }, "admin"],
    [{ id: 9, role: "corporate_client" }, "corporate_client"],
    [null, "client"],
  ])("resolves the guide role for %o as %s", async (user, expected) => {
    mockUserById.mockReturnValue(user);
    const wrapper = await mountMain();

    expect(wrapper.findComponent({ name: "GuideNavigation" }).props("currentRole")).toBe(expected);
  });

  test("selecting a module renders its guide and resets section and search", async () => {
    const wrapper = await mountMain();

    wrapper.findComponent({ name: "GuideNavigation" }).vm.$emit("module-selected", "dashboard");
    await nextTick();

    const guide = wrapper.findComponent({ name: "ModuleGuide" });
    expect(guide.props("module")).toBe("dashboard");
    expect(guide.props("section")).toBeNull();
    expect(wrapper.text()).not.toContain("Bienvenido al Manual de Usuario");
  });

  test("selecting a section forwards it to the module guide", async () => {
    const wrapper = await mountMain();
    wrapper.findComponent({ name: "GuideNavigation" }).vm.$emit("module-selected", "dashboard");
    await nextTick();

    wrapper.findComponent({ name: "GuideNavigation" }).vm.$emit("section-selected", "overview");
    await nextTick();

    expect(wrapper.findComponent({ name: "ModuleGuide" }).props("section")).toBe("overview");
  });

  test("quick links open the requested module", async () => {
    const wrapper = await mountMain();

    wrapper.findComponent({ name: "QuickLinksCard" }).vm.$emit("navigate", "processes");
    await nextTick();

    expect(wrapper.findComponent({ name: "ModuleGuide" }).props("module")).toBe("processes");
  });

  test("a search result jumps to its module and section and clears the query", async () => {
    const wrapper = await mountMain();

    wrapper
      .findComponent({ name: "SearchGuide" })
      .vm.$emit("result-selected", { moduleId: "secop", sectionId: "alerts" });
    await nextTick();

    const guide = wrapper.findComponent({ name: "ModuleGuide" });
    expect(guide.props("module")).toBe("secop");
    expect(guide.props("section")).toBe("alerts");
    expect(wrapper.findComponent({ name: "SearchGuide" }).props("modelValue")).toBe("");
  });

  test("search submissions are logged for diagnostics", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const wrapper = await mountMain();

    wrapper.findComponent({ name: "SearchGuide" }).vm.$emit("search", "firmas");

    expect(logSpy).toHaveBeenCalledWith("Searching for:", "firmas");
    logSpy.mockRestore();
  });

  test("the mobile toggle shows the module name resolved from the guide store", async () => {
    const wrapper = await mountMain();
    wrapper.findComponent({ name: "GuideNavigation" }).vm.$emit("module-selected", "dashboard");
    await nextTick();

    expect(wrapper.text()).toContain("Panel Principal");
  });

  test("falls back to the module id when the store does not know it", async () => {
    mockGetModulesForRole.mockReturnValue([]);
    const wrapper = await mountMain();
    wrapper.findComponent({ name: "GuideNavigation" }).vm.$emit("module-selected", "misterio");
    await nextTick();

    expect(wrapper.text()).toContain("misterio");
  });

  test("the mobile toggle opens and the nav close event hides it again", async () => {
    const wrapper = await mountMain();

    await wrapper.find("button").trigger("click");
    const navs = wrapper.findAllComponents({ name: "GuideNavigation" });
    expect(navs).toHaveLength(2);

    navs[1].vm.$emit("close");
    await nextTick();
    expect(wrapper.findAllComponents({ name: "GuideNavigation" })).toHaveLength(1);
  });

  test("a route refresh param resets the whole view", async () => {
    const wrapper = await mountMain();
    wrapper.findComponent({ name: "GuideNavigation" }).vm.$emit("module-selected", "dashboard");
    await nextTick();
    expect(wrapper.findComponent({ name: "ModuleGuide" }).exists()).toBe(true);

    mockCurrentRoute.value = { params: { refresh: Date.now ? "1" : "1" } };
    await nextTick();

    expect(wrapper.findComponent({ name: "ModuleGuide" }).exists()).toBe(false);
    expect(wrapper.text()).toContain("Bienvenido al Manual de Usuario");
  });
});
