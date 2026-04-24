import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useServicesTramitesStore } from "@/stores/services_tramites";

const mockRouterPush = jest.fn();

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("@/composables/useServiceRequestHelpers", () => ({
  __esModule: true,
  statusClass: (status) => `mock-class-${status}`,
  formatDate: (d) => d || "-",
}));

import MyServiceRequests from "@/views/services/MyServiceRequests.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function buildRequest({ id = 1, tracking_number = "2026-00001", status = "OPEN", status_display = "Abierto", service_name = "Registro", created_at = "2026-04-01T10:00:00Z" } = {}) {
  return { id, tracking_number, status, status_display, service_name, service_short_title: "Reg", created_at };
}

describe("MyServiceRequests.vue", () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    setActivePinia(createPinia());
    store = useServicesTramitesStore();
  });

  function mountComponent() {
    store.fetchServices = jest.fn().mockResolvedValue([
      { id: 1, name: "Registro Marcario" },
    ]);

    return mount(MyServiceRequests, {
      global: {
        stubs: { "router-link": true },
      },
    });
  }

  test("renders list of submitted requests", async () => {
    store.fetchMyRequests = jest.fn().mockResolvedValue({
      results: [buildRequest(), buildRequest({ id: 2, tracking_number: "2026-00002" })],
    });

    const wrapper = mountComponent();
    await flushPromises();

    const cards = wrapper.findAll("button.w-full");
    expect(cards).toHaveLength(2);
    expect(wrapper.text()).toContain("2026-00001");
    expect(wrapper.text()).toContain("2026-00002");
  });

  test("shows status badge for each request", async () => {
    store.fetchMyRequests = jest.fn().mockResolvedValue({
      results: [buildRequest({ status: "IN_STUDY", status_display: "En Estudio" })],
    });

    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain("En Estudio");
  });

  test("navigates to request detail on click", async () => {
    store.fetchMyRequests = jest.fn().mockResolvedValue({
      results: [buildRequest({ id: 42 })],
    });

    const wrapper = mountComponent();
    await flushPromises();

    await wrapper.find("button.w-full").trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "service_request_detail",
      params: { id: 42 },
    });
  });

  test("shows empty message when no requests match filters", async () => {
    store.fetchMyRequests = jest.fn().mockResolvedValue({ results: [] });

    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain("No hay solicitudes registradas");
  });
});
