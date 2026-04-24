import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useServicesTramitesStore } from "@/stores/services_tramites";

const mockRouterPush = jest.fn();

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockRouterPush }),
}));

import ServicesList from "@/views/services/ServicesList.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ServicesList.vue", () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    setActivePinia(createPinia());
    store = useServicesTramitesStore();
  });

  function mountComponent() {
    return mount(ServicesList, {
      global: {
        stubs: { "router-link": true },
      },
    });
  }

  test("renders grid of active services", async () => {
    store.fetchServices = jest.fn().mockResolvedValue([
      { id: 1, name: "Registro Marcario", short_title: "Registro", description: "Desc", icon_image_url: null },
      { id: 2, name: "Consulta", short_title: "Consulta", description: "Desc 2", icon_image_url: null },
    ]);

    const wrapper = mountComponent();
    await flushPromises();

    const cards = wrapper.findAll("button");
    expect(cards).toHaveLength(2);
    expect(wrapper.text()).toContain("Registro Marcario");
    expect(wrapper.text()).toContain("Consulta");
  });

  test("navigates to service detail on card click", async () => {
    store.fetchServices = jest.fn().mockResolvedValue([
      { id: 7, name: "Tramite", short_title: "T", description: "", icon_image_url: null },
    ]);

    const wrapper = mountComponent();
    await flushPromises();

    await wrapper.find("button").trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "service_detail",
      params: { id: 7 },
    });
  });

  test("shows empty message when no services available", async () => {
    store.fetchServices = jest.fn().mockResolvedValue([]);

    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain("No hay servicios disponibles");
  });
});
