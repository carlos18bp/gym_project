import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useProcessStore } from "@/stores/process";
import DirectoryUserDetailsModal from "@/components/directory/DirectoryUserDetailsModal.vue";

const mockRouterPush = jest.fn();

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  XMarkIcon: { template: "<span />" },
  CubeTransparentIcon: { template: "<span />" },
}));

const ModalTransitionStub = {
  template: "<div><slot /></div>",
};

const buildProcess = (overrides = {}) => ({
  id: 1,
  case: { type: "Civil" },
  subcase: "Sub",
  ref: "REF-1",
  authority: "Court",
  stages: [{ status: "Admisión" }],
  client: { id: 10 },
  lawyer: { id: 99 },
  ...overrides,
});

describe("DirectoryUserDetailsModal.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("renders user info and shows only matching client processes", () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const processStore = useProcessStore();
    processStore.$patch({
      dataLoaded: true,
      processes: [
        buildProcess({ id: 1, client: { id: 10 }, case: { type: "Civil" } }),
        buildProcess({ id: 2, client: { id: 99 }, case: { type: "Penal" } }),
      ],
    });

    const wrapper = mount(DirectoryUserDetailsModal, {
      props: {
        isVisible: true,
        user: {
          id: 10,
          first_name: "Ana",
          last_name: "Diaz",
          email: "ana@example.com",
          role: "client",
        },
      },
      global: {
        plugins: [pinia],
        stubs: {
          ModalTransition: ModalTransitionStub,
        },
      },
    });

    expect(wrapper.text()).toContain("Ana Diaz");
    expect(wrapper.text()).toContain("Cliente");
    expect(wrapper.text()).toContain("ana@example.com");
    expect(wrapper.text()).toContain("Civil");
    expect(wrapper.text()).not.toContain("Penal");

    const processButtons = wrapper
      .findAll("button")
      .filter((button) => (button.text() || "").includes("Ver proceso"));

    expect(processButtons).toHaveLength(1);
  });

  test("loads processes when visible and data is not loaded", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const processStore = useProcessStore();
    processStore.$patch({ dataLoaded: false, processes: [] });

    const fetchSpy = jest
      .spyOn(processStore, "fetchProcessesData")
      .mockResolvedValue();

    const wrapper = mount(DirectoryUserDetailsModal, {
      props: {
        isVisible: true,
        user: {
          id: 1,
          first_name: "Test",
          last_name: "User",
          email: "t@test.com",
          role: "lawyer",
        },
      },
      global: {
        plugins: [pinia],
        stubs: {
          ModalTransition: ModalTransitionStub,
        },
      },
    });

    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalled();
    wrapper.unmount();
  });

  test("navigates to process detail and list, emitting close", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const processStore = useProcessStore();
    processStore.$patch({
      dataLoaded: true,
      processes: [buildProcess({ id: 5, client: { id: 10 } })],
    });

    const wrapper = mount(DirectoryUserDetailsModal, {
      props: {
        isVisible: true,
        user: {
          id: 10,
          first_name: "Ana",
          last_name: "Diaz",
          email: "ana@example.com",
          role: "client",
        },
      },
      global: {
        plugins: [pinia],
        stubs: {
          ModalTransition: ModalTransitionStub,
        },
      },
    });

    const detailButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Ver proceso"));

    expect(detailButton).toBeTruthy();

    await detailButton.trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "process_detail",
      params: { process_id: 5 },
    });

    expect(wrapper.emitted("close")).toBeTruthy();

    const listButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Ver todos en Procesos"));

    expect(listButton).toBeTruthy();

    await listButton.trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "process_list",
      params: { user_id: 10, display: "" },
    });

    expect(wrapper.emitted("close").length).toBeGreaterThan(1);
  });
});
