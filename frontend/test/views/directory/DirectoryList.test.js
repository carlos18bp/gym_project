import { mount } from "@vue/test-utils";

const mockFilteredUsers = jest.fn();
const mockInit = jest.fn().mockResolvedValue(undefined);

jest.mock("@/stores/auth/user", () => ({
  useUserStore: () => ({
    filteredUsers: mockFilteredUsers,
    init: mockInit,
  }),
}));

import DirectoryList from "@/views/directory/DirectoryList.vue";

const usersFixture = [
  {
    id: 1,
    first_name: "Ana",
    last_name: "Gómez",
    role: "lawyer",
    email: "ana@gm.co",
    photo_profile: "https://cdn/ana.png",
  },
  {
    id: 2,
    first_name: "Luis",
    last_name: "Pérez",
    role: "client",
    email: "luis@gm.co",
    photo_profile: null,
  },
];

const stubs = {
  ModuleHeader: { name: "ModuleHeader", props: ["title"], template: "<header><slot name='menu-button' /></header>" },
  SearchBarAndFilterBy: { name: "SearchBarAndFilterBy", emits: ["update:searchQuery"], template: "<div />" },
  DirectoryUserDetailsModal: {
    name: "DirectoryUserDetailsModal",
    props: ["isVisible", "user"],
    emits: ["close"],
    template: "<div data-testid='user-modal-stub'>{{ user.first_name }}</div>",
  },
  teleport: true,
};

const mountList = () => mount(DirectoryList, { global: { stubs } });

describe("views/directory/DirectoryList.vue", () => {
  beforeEach(() => {
    mockFilteredUsers.mockReset();
    mockInit.mockClear();
    mockFilteredUsers.mockReturnValue(usersFixture);
  });

  test("initializes the user store on mount", () => {
    mountList();

    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  test("renders one row per filtered user", () => {
    const wrapper = mountList();

    expect(wrapper.findAll("li")).toHaveLength(2);
    expect(wrapper.text()).toContain("Ana Gómez");
    expect(wrapper.text()).toContain("Luis Pérez");
  });

  test.each([
    ["client", "Cliente"],
    ["basic", "Básico"],
    ["corporate_client", "Corporativo"],
    ["lawyer", "Abogado"],
  ])("labels the %s role as %s", (role, label) => {
    mockFilteredUsers.mockReturnValue([{ ...usersFixture[0], role }]);
    const wrapper = mountList();

    expect(wrapper.text()).toContain(`(${label})`);
  });

  test("shows the profile photo when the user has one", () => {
    const wrapper = mountList();

    expect(wrapper.get("img").attributes("src")).toBe("https://cdn/ana.png");
  });

  test("falls back to initials when the user has no photo", () => {
    const wrapper = mountList();

    expect(wrapper.text()).toContain("LP");
  });

  test("falls back to a question mark when the user has no names", () => {
    mockFilteredUsers.mockReturnValue([
      { ...usersFixture[1], first_name: null, last_name: null },
    ]);
    const wrapper = mountList();

    expect(wrapper.text()).toContain("?");
  });

  test("links each user email as mailto", () => {
    const wrapper = mountList();

    expect(wrapper.get("a[href='mailto:ana@gm.co']").text()).toBe("ana@gm.co");
  });

  test("opens the details modal when a row is clicked", async () => {
    const wrapper = mountList();

    expect(wrapper.find("[data-testid='user-modal-stub']").exists()).toBe(false);

    await wrapper.findAll("li")[0].trigger("click");

    expect(wrapper.get("[data-testid='user-modal-stub']").text()).toBe("Ana");
  });

  test("closes the details modal on the close event", async () => {
    const wrapper = mountList();
    await wrapper.findAll("li")[0].trigger("click");

    wrapper.findComponent({ name: "DirectoryUserDetailsModal" }).vm.$emit("close");
    await wrapper.vm.$nextTick();

    expect(wrapper.find("[data-testid='user-modal-stub']").exists()).toBe(false);
  });
});
