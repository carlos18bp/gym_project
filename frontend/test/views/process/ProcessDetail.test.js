import { shallowMount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { reactive, nextTick } from "vue";

import ProcessDetail from "@/views/process/ProcessDetail.vue";
import { useProcessStore } from "@/stores/process";
import { useUserStore } from "@/stores/auth/user";
import { useRecentProcessStore } from "@/stores/dashboard/recentProcess";

const mockRouterPush = jest.fn();
let mockRoute;

jest.mock("vue-router", () => ({
  __esModule: true,
  useRoute: () => mockRoute,
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("@heroicons/vue/20/solid", () => {
  const createIcon = (name) => ({ name, template: "<span />" });
  return {
    __esModule: true,
    ArrowDownTrayIcon: createIcon("ArrowDownTrayIcon"),
    MagnifyingGlassIcon: createIcon("MagnifyingGlassIcon"),
    ChevronLeftIcon: createIcon("ChevronLeftIcon"),
    ChevronRightIcon: createIcon("ChevronRightIcon"),
    ChevronDownIcon: createIcon("ChevronDownIcon"),
  };
});

jest.mock("@heroicons/vue/24/outline", () => {
  const createIcon = (name) => ({ name, template: "<span />" });
  return {
    __esModule: true,
    EyeIcon: createIcon("EyeIcon"),
  };
});

const MenuStub = {
  name: "Menu",
  setup(_, { slots }) {
    return () => (slots.default ? slots.default({ open: false }) : null);
  },
};

const MenuItemStub = {
  name: "MenuItem",
  setup(_, { slots }) {
    return () => (slots.default ? slots.default({ active: false }) : null);
  },
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const buildProcess = (overrides = {}) => ({
  id: 1,
  case: { type: "Civil" },
  subcase: "Subcase",
  ref: "REF-1",
  plaintiff: "Alice",
  defendant: "Bob",
  authority: "Court",
  authority_email: "court@test.com",
  stages: [{ status: "Admisión" }],
  clients: [{ id: 3, first_name: "Ana", last_name: "Lopez", photo_profile: "" }],
  progress: 50,
  case_files: [
    { id: 1, file: "http://files.test/file-one.pdf", created_at: "2024-01-01T00:00:00Z" },
    { id: 2, file: "http://files.test/file-two.pdf", created_at: "2024-01-02T00:00:00Z" },
    { id: 3, file: "http://files.test/notes.txt", created_at: "2024-01-03T00:00:00Z" },
  ],
  ...overrides,
});

const mountView = async ({
  process = buildProcess(),
  currentUser = { id: 7, role: "lawyer" },
  routeParams = { process_id: "1" },
} = {}) => {
  const pinia = createPinia();
  setActivePinia(pinia);

  const processStore = useProcessStore();
  const userStore = useUserStore();
  const recentProcessStore = useRecentProcessStore();

  processStore.$patch({ processes: [process] });
  userStore.$patch({ currentUser });

  const processInitSpy = jest.spyOn(processStore, "init").mockResolvedValue();
  const userInitSpy = jest.spyOn(userStore, "init").mockResolvedValue();
  const updateRecentSpy = jest
    .spyOn(recentProcessStore, "updateRecentProcess")
    .mockResolvedValue();

  mockRoute.params = routeParams;

  const wrapper = shallowMount(ProcessDetail, {
    global: {
      plugins: [pinia],
      stubs: {
        Menu: MenuStub,
        MenuButton: { template: "<button><slot /></button>" },
        MenuItems: { template: "<div><slot /></div>" },
        MenuItem: MenuItemStub,
        ProcessStageProgress: { template: "<div />" },
        ProcessHistoryModal: { template: "<div />", props: ["isOpen", "stages"] },
        ProcessUsersModal: { template: "<div />", props: ["isOpen", "users"] },
      },
    },
  });

  await flushPromises();

  return { wrapper, processInitSpy, userInitSpy, updateRecentSpy };
};

describe("ProcessDetail.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute = reactive({ params: {}, query: {} });
  });

  test("initializes stores and updates recent process", async () => {
    const { processInitSpy, userInitSpy, updateRecentSpy } = await mountView();

    expect(processInitSpy).toHaveBeenCalled();
    expect(userInitSpy).toHaveBeenCalled();
    expect(updateRecentSpy).toHaveBeenCalledWith("1");
  });

  test("filters case files, paginates, and resets page on search", async () => {
    const { wrapper } = await mountView();

    wrapper.vm.$.setupState.itemsPerPage = 1;
    wrapper.vm.$.setupState.currentPage = 2;

    expect(wrapper.vm.$.setupState.totalPages).toBe(3);
    expect(wrapper.vm.$.setupState.paginatedCaseFiles).toHaveLength(1);

    wrapper.vm.$.setupState.searchTerm = "notes";
    await nextTick();

    expect(wrapper.vm.$.setupState.currentPage).toBe(1);
    expect(wrapper.vm.$.setupState.filteredCaseFiles).toHaveLength(1);
    expect(wrapper.vm.$.setupState.getFileName("http://files.test/file-one.pdf")).toBe(
      "file-one.pdf"
    );
  });

  test("navigates to list and edit with helper methods", async () => {
    const { wrapper } = await mountView({ currentUser: { id: 9, role: "lawyer" } });

    wrapper.vm.$.setupState.activeTab = "my_processes";
    expect(wrapper.vm.$.setupState.getActiveTabLabel()).toBe("Mis Procesos");

    wrapper.vm.$.setupState.navigateToTab("archived_processes");
    expect(mockRouterPush).toHaveBeenLastCalledWith({
      path: "/process_list/9/history",
      query: {},
    });

    wrapper.vm.$.setupState.navigateToEdit();
    expect(mockRouterPush).toHaveBeenLastCalledWith({
      name: "process_form",
      params: { action: "edit", process_id: "1" },
    });

    expect(wrapper.vm.$.setupState.getInitials("Ana", "Lopez")).toBe("AL");
    expect(wrapper.vm.$.setupState.getPrimaryClient(buildProcess())).toEqual(
      expect.objectContaining({ first_name: "Ana" })
    );

    const converted = wrapper.vm.$.setupState.convertToBogotaTime("2024-01-01T00:00:00Z");
    expect(converted).toEqual(expect.any(String));
  });

  test("opens and downloads files", async () => {
    const { wrapper } = await mountView();
    const fileUrl = "http://files.test/file-one.pdf";

    const originalFetch = global.fetch;
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    const originalCreateElement = document.createElement;

    const link = originalCreateElement.call(document, "a");
    const clickSpy = jest.spyOn(link, "click").mockImplementation(() => {});

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["test"], { type: "text/plain" }),
    });
    window.URL.createObjectURL = jest.fn(() => "blob:mock");
    window.URL.revokeObjectURL = jest.fn();
    const createElementSpy = jest.spyOn(document, "createElement").mockReturnValue(link);
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => {});

    wrapper.vm.$.setupState.openFile(fileUrl);
    expect(window.open).toHaveBeenCalledWith(fileUrl, "_blank");

    await wrapper.vm.$.setupState.downloadFile(fileUrl);
    expect(global.fetch).toHaveBeenCalledWith(fileUrl);
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    global.fetch = originalFetch;
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
    createElementSpy.mockRestore();
    openSpy.mockRestore();
  });
});
