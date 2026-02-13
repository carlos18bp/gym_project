import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import { useRecentProcessStore } from "@/stores/dashboard/recentProcess";

import RecentProcessList from "@/components/dashboard/RecentProcessList.vue";

const mockRouterPush = jest.fn();

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("RecentProcessList.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("shows empty state when there are no recent processes", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const recentProcessStore = useRecentProcessStore();
    jest.spyOn(recentProcessStore, "fetchRecentProcesses").mockResolvedValue();

    recentProcessStore.$patch({ recentProcesses: [] });

    const wrapper = mount(RecentProcessList, {
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Procesos Recientes");
    expect(wrapper.text()).toContain("No hay procesos recientes");
  });

  test("renders processes and navigates on click", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const recentProcessStore = useRecentProcessStore();
    jest.spyOn(recentProcessStore, "fetchRecentProcesses").mockResolvedValue();

    recentProcessStore.$patch({
      recentProcesses: [
        {
          id: 10,
          process: {
            id: 999,
            clients: [{ first_name: "A", last_name: "B" }],
            case: { type: "Tutela" },
          },
        },
      ],
    });

    const wrapper = mount(RecentProcessList, {
      global: {
        plugins: [pinia],
        stubs: {
          ChevronDownIcon: { template: "<span />" },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("A B");
    expect(wrapper.text()).toContain("Tutela");

    await wrapper.findAll(".cursor-pointer")[0].trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "process_detail",
      params: { process_id: 999 },
    });
  });
});
