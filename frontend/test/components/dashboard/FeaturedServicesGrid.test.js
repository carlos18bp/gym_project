import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useServicesTramitesStore } from "@/stores/services_tramites";

const mockRouterPush = jest.fn();

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockRouterPush }),
}));

import FeaturedServicesGrid from "@/components/dashboard/FeaturedServicesGrid.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("FeaturedServicesGrid.vue", () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    setActivePinia(createPinia());
    store = useServicesTramitesStore();
  });

  function mountComponent() {
    return mount(FeaturedServicesGrid, {
      global: {
        stubs: { "router-link": { template: '<a data-test="ver-todos"><slot /></a>' } },
      },
    });
  }

  test("renders service cards from store data", async () => {
    store.fetchFeaturedServices = jest.fn().mockResolvedValue([
      { id: 1, name: "Registro Marcario", short_title: "Registro", icon_image_url: null },
      { id: 2, name: "Consulta Legal", short_title: "Consulta", icon_image_url: null },
    ]);

    const wrapper = mountComponent();
    await flushPromises();

    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(2);
  });

  test("navigates to service detail on click", async () => {
    store.fetchFeaturedServices = jest.fn().mockResolvedValue([
      { id: 5, name: "Servicio", short_title: "Srv", icon_image_url: null },
    ]);

    const wrapper = mountComponent();
    await flushPromises();

    await wrapper.find("button").trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "service_detail",
      params: { id: 5 },
    });
  });

  test("shows Ver todos link", async () => {
    store.fetchFeaturedServices = jest.fn().mockResolvedValue([]);

    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.find('[data-test="ver-todos"]').exists()).toBe(true);
  });
});
