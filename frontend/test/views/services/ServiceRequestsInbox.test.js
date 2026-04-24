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
  statusClass: jest.fn(() => "bg-gray-100"),
  formatDate: jest.fn(() => "01/01/2026"),
}));

import ServiceRequestsInbox from "@/views/services/ServiceRequestsInbox.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const defaultRequest = {
  id: 10,
  tracking_number: "2026-00001",
  service_name: "Registro",
  status: "OPEN",
  status_display: "Abierto",
  created_at: "2026-01-01T00:00:00Z",
};

describe("ServiceRequestsInbox.vue", () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    setActivePinia(createPinia());
    store = useServicesTramitesStore();
    store.fetchServices = jest.fn().mockResolvedValue([
      { id: 1, name: "Registro" },
      { id: 2, name: "Consulta" },
    ]);
    store.fetchInboxRequests = jest.fn().mockResolvedValue({
      results: [defaultRequest],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders request rows on mount", async () => {
    const wrapper = mount(ServiceRequestsInbox);
    await flushPromises();

    expect(wrapper.text()).toContain("2026-00001");
    expect(wrapper.text()).toContain("Registro");
  });

  test("shows empty-state message when no requests exist", async () => {
    store.fetchInboxRequests = jest.fn().mockResolvedValue({ results: [] });

    const wrapper = mount(ServiceRequestsInbox);
    await flushPromises();

    expect(wrapper.text()).toContain("No hay solicitudes");
  });

  test("service catalog is fetched on mount for filter options", async () => {
    mount(ServiceRequestsInbox);
    await flushPromises();

    expect(store.fetchServices).toHaveBeenCalled();
  });

  test("clicking apply-filters button re-fetches inbox requests", async () => {
    const wrapper = mount(ServiceRequestsInbox);
    await flushPromises();

    const filterBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Aplicar filtros")
    );
    await filterBtn.trigger("click");
    await flushPromises();

    expect(store.fetchInboxRequests).toHaveBeenCalledTimes(2);
  });

  test("goToDetail navigates to service_request_detail with request id", async () => {
    const wrapper = mount(ServiceRequestsInbox);
    await flushPromises();

    const detailBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Ver detalle")
    );
    await detailBtn.trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "service_request_detail",
      params: { id: 10 },
    });
  });

  test("fetchInboxRequests error leaves requests list empty", async () => {
    store.fetchInboxRequests = jest.fn().mockRejectedValue(new Error("net"));
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = mount(ServiceRequestsInbox);
    await flushPromises();
    consoleSpy.mockRestore();

    expect(wrapper.text()).toContain("No hay solicitudes");
  });
});
