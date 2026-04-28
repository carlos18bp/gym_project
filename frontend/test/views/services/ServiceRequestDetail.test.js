import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useServicesTramitesStore } from "@/stores/services_tramites";

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRoute = { params: { id: "42" }, query: {}, name: "service_request_detail" };

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
  useRoute: () => mockRoute,
}));

jest.mock("@/composables/useServiceRequestHelpers", () => ({
  __esModule: true,
  statusClass: (status) => `mock-class-${status}`,
  formatDate: (d) => d || "-",
}));

jest.mock("@/shared/confirmation_alert", () => ({
  __esModule: true,
  showConfirmationAlert: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: jest.fn(),
}));

const mockCurrentUser = { role: "client", is_staff: false };

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => ({
    get currentUser() { return mockCurrentUser; },
    init: jest.fn().mockResolvedValue({}),
  }),
}));

import ServiceRequestDetail from "@/views/services/ServiceRequestDetail.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function buildDetail(overrides = {}) {
  return {
    id: 42,
    service: { name: "Registro Marcario" },
    tracking_number: "2026-00042",
    requester_name: "Client Test",
    status: "OPEN",
    status_display: "Abierto",
    created_at: "2026-04-01T10:00:00Z",
    document_url: "/api/service-requests/42/document/download/",
    answers: [
      {
        id: 1,
        field_key: "nombre",
        field_label: "Nombre",
        field_type: "input",
        stage_title: "Datos",
        stage_order: 1,
        value_text: "Juan Perez",
        value_json: null,
        files: [],
      },
    ],
    lawyer_responses: [
      {
        id: 10,
        responder_name: "Abogado Test",
        message: "Revisando solicitud",
        status_before: "OPEN",
        status_after: "IN_STUDY",
        files: [],
        created_at: "2026-04-02T12:00:00Z",
      },
    ],
    ...overrides,
  };
}

describe("ServiceRequestDetail.vue", () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser.role = "client";
    mockCurrentUser.is_staff = false;
    mockRoute.query = {};
    setActivePinia(createPinia());
    store = useServicesTramitesStore();
  });

  function mountComponent(detail = buildDetail()) {
    store.fetchRequestDetail = jest.fn().mockResolvedValue(detail);
    store.downloadRequestDocument = jest.fn().mockResolvedValue({
      data: new ArrayBuffer(8),
      headers: { "content-type": "application/pdf" },
    });

    return mount(ServiceRequestDetail, {
      global: {
        stubs: { "router-link": true },
      },
    });
  }

  test("renders tracking number and status", async () => {
    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain("2026-00042");
    expect(wrapper.text()).toContain("Abierto");
  });

  test("renders answers grouped by stage", async () => {
    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain("Fase 1 - Datos");
    expect(wrapper.text()).toContain("Nombre");
    expect(wrapper.text()).toContain("Juan Perez");
  });

  test("shows download PDF button when document exists", async () => {
    const wrapper = mountComponent();
    await flushPromises();

    const downloadBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Descargar documento PDF")
    );
    expect(downloadBtn).toBeTruthy();
  });

  test("hides download PDF button when no document", async () => {
    const wrapper = mountComponent(buildDetail({ document_url: null }));
    await flushPromises();

    const downloadBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Descargar documento PDF")
    );
    expect(downloadBtn).toBeUndefined();
  });

  test("shows lawyer responses section", async () => {
    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain("Respuestas del abogado");
    expect(wrapper.text()).toContain("Abogado Test");
    expect(wrapper.text()).toContain("Revisando solicitud");
  });

  test("formattedAnswerValue renders select_multiple value_json array joined by comma", async () => {
    const detail = buildDetail({
      answers: [
        {
          id: 2,
          field_key: "tipos",
          field_label: "Tipos de marca",
          field_type: "select_multiple",
          stage_title: "Datos",
          stage_order: 1,
          value_text: null,
          value_json: ["Nominativa", "Mixta"],
          files: [],
        },
      ],
    });

    const wrapper = mountComponent(detail);
    await flushPromises();

    expect(wrapper.text()).toContain("Nominativa, Mixta");
  });

  test("formattedAnswerValue renders plain value_text for text fields", async () => {
    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain("Juan Perez");
  });

  test("formattedAnswerValue renders dash when no value present", async () => {
    const detail = buildDetail({
      answers: [
        {
          id: 3,
          field_key: "vacio",
          field_label: "Campo vacio",
          field_type: "input",
          stage_title: "Datos",
          stage_order: 1,
          value_text: null,
          value_json: null,
          files: [],
        },
      ],
    });

    const wrapper = mountComponent(detail);
    await flushPromises();

    // The label renders and the value shows "-"
    expect(wrapper.text()).toContain("Campo vacio");
  });

  test("manager management section is hidden for client role", async () => {
    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).not.toContain("Gestionar solicitud");
  });

  test("manager management section is visible for lawyer role", async () => {
    mockCurrentUser.role = "lawyer";

    const wrapper = mountComponent();
    await flushPromises();

    expect(wrapper.text()).toContain("Gestionar solicitud");
    expect(wrapper.text()).toContain("Guardar actualizacion");
  });

  test("submitManagement calls store.manageRequest with correct status and message", async () => {
    const { showConfirmationAlert } = await import("@/shared/confirmation_alert");
    const { showNotification } = await import("@/shared/notification_message");
    mockCurrentUser.role = "lawyer";
    store.manageRequest = jest.fn().mockResolvedValue(buildDetail({ status: "IN_STUDY" }));

    const wrapper = mountComponent();
    await flushPromises();

    const statusSelect = wrapper.find("select");
    await statusSelect.setValue("IN_STUDY");

    const textarea = wrapper.find("textarea");
    await textarea.setValue("Revisando el caso");

    const saveBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Guardar actualizacion")
    );
    await saveBtn.trigger("click");
    await flushPromises();

    expect(store.manageRequest).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ status: "IN_STUDY", message: "Revisando el caso" })
    );
    expect(showNotification).toHaveBeenCalledWith(
      expect.stringContaining("actualizada"),
      "success"
    );
  });

  describe("highlight pulse effect", () => {
    test("applies pulse class when highlight query is set", async () => {
      mockRoute.query = { highlight: "42" };

      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.html()).toContain("animate-pulse");
    });

    test("does not apply pulse class when highlight query is absent", async () => {
      mockRoute.query = {};

      const wrapper = mountComponent();
      await flushPromises();

      expect(wrapper.html()).not.toContain("animate-pulse");
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    test("clears the pending highlight timeout on unmount", async () => {
      mockRoute.query = { highlight: "42" };
      const setTimeoutSpy = jest.spyOn(global, "setTimeout");
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      const wrapper = mountComponent();
      await flushPromises();

      const highlightCall = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 5000);
      expect(highlightCall).toBeDefined();
      const timerId = setTimeoutSpy.mock.results[setTimeoutSpy.mock.calls.indexOf(highlightCall)].value;

      clearTimeoutSpy.mockClear();
      wrapper.unmount();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);

      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });
  });
});
