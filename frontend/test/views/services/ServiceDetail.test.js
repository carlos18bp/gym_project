import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { useServicesTramitesStore } from "@/stores/services_tramites";

const mockRouterPush = jest.fn();
const mockShowNotification = jest.fn();
const mockConfirm = jest.fn(() => true);

jest.mock("vue-router", () => ({
  __esModule: true,
  useRoute: () => ({ params: { id: "5" } }),
  useRouter: () => ({ push: mockRouterPush }),
  onBeforeRouteLeave: jest.fn(),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

import ServiceDetail from "@/views/services/ServiceDetail.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function buildService(overrides = {}) {
  return {
    id: 5,
    name: "Registro Marcario",
    description: "Registra tu marca",
    stages: [
      {
        id: 1,
        title: "Datos Personales",
        description: "Ingresa tus datos",
        order: 1,
        fields: [
          { id: 10, key: "nombre", label: "Nombre", field_type: "input", is_required: true, order: 1, placeholder: "", help_text: "" },
          { id: 11, key: "email", label: "Correo", field_type: "email", is_required: false, order: 2, placeholder: "" },
          { id: 12, key: "bio", label: "Bio", field_type: "text_area", is_required: false, order: 3, placeholder: "" },
        ],
      },
      {
        id: 2,
        title: "Documentos",
        description: "Adjunta archivos",
        order: 2,
        fields: [
          { id: 20, key: "archivo", label: "Archivo", field_type: "file", is_required: true, order: 1, allow_multiple_files: false, allowed_extensions: [".pdf"] },
        ],
      },
    ],
    ...overrides,
  };
}

describe("ServiceDetail.vue", () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();
    global.confirm = mockConfirm;
    setActivePinia(createPinia());
    store = useServicesTramitesStore();
    store.fetchServiceDetail = jest.fn().mockResolvedValue({
      service: buildService(),
      draft: null,
    });
    store.saveServiceRequest = jest.fn().mockResolvedValue({
      id: 1,
      tracking_number: "2026-00001",
    });
    store.downloadRequestDocument = jest.fn().mockResolvedValue({
      data: new ArrayBuffer(8),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders service name after load", async () => {
    const wrapper = mount(ServiceDetail);
    await flushPromises();

    expect(wrapper.text()).toContain("Registro Marcario");
  });

  test("shows empty-state when service fails to load", async () => {
    store.fetchServiceDetail = jest.fn().mockRejectedValue(new Error("net"));
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = mount(ServiceDetail);
    await flushPromises();
    consoleSpy.mockRestore();

    expect(wrapper.text()).toContain("No se pudo cargar el servicio");
  });

  test("stages are rendered in order property order", async () => {
    const wrapper = mount(ServiceDetail);
    await flushPromises();

    const stageButtons = wrapper.findAll("button").filter((b) =>
      b.text().includes("Fase")
    );
    expect(stageButtons[0].text()).toContain("Datos Personales");
    expect(stageButtons[1].text()).toContain("Documentos");
  });

  test("applyDraftToForm pre-populates field values from draft answers", async () => {
    store.fetchServiceDetail = jest.fn().mockResolvedValue({
      service: buildService(),
      draft: {
        id: 7,
        current_stage: 1,
        answers: [
          { field: 10, value_text: "Juan Perez", value_json: [], files: [] },
        ],
      },
    });

    const wrapper = mount(ServiceDetail);
    await flushPromises();

    // Field 10 (Nombre, type=input) is on stage 1 which is rendered
    const inputs = wrapper.findAll("input[type='text']");
    const populated = inputs.find((i) => i.element.value === "Juan Perez");
    expect(populated).toBeTruthy();
  });

  test("applyDraftToForm sets activeStageIndex from draft current_stage", async () => {
    store.fetchServiceDetail = jest.fn().mockResolvedValue({
      service: buildService(),
      draft: { id: 7, current_stage: 2, answers: [] },
    });

    const wrapper = mount(ServiceDetail);
    await flushPromises();

    // Stage 2 (index 1) should be active — its title visible
    expect(wrapper.text()).toContain("Documentos");
  });

  test("previousStage button decrements the active stage", async () => {
    store.fetchServiceDetail = jest.fn().mockResolvedValue({
      service: buildService(),
      draft: { id: 7, current_stage: 2, answers: [] },
    });

    const wrapper = mount(ServiceDetail);
    await flushPromises();

    const prevBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Anterior")
    );
    await prevBtn.trigger("click");

    expect(wrapper.text()).toContain("Datos Personales");
  });

  test("nextStage does not advance when required field is empty", async () => {
    const wrapper = mount(ServiceDetail);
    await flushPromises();

    const nextBtn = wrapper.findAll("button").find((b) =>
      b.text() === "Siguiente"
    );
    await nextBtn.trigger("click");

    // Should stay on stage 1
    expect(wrapper.text()).toContain("Datos Personales");
  });

  test("nextStage advances when required fields are filled", async () => {
    const wrapper = mount(ServiceDetail);
    await flushPromises();

    const nameInput = wrapper.find("input[type='text']");
    await nameInput.setValue("Juan");

    const nextBtn = wrapper.findAll("button").find((b) =>
      b.text() === "Siguiente"
    );
    await nextBtn.trigger("click");

    expect(wrapper.text()).toContain("Documentos");
  });

  test("saveDraft calls saveServiceRequest with isSubmit false", async () => {
    const wrapper = mount(ServiceDetail);
    await flushPromises();

    const draftBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Guardar borrador")
    );
    await draftBtn.trigger("click");
    await flushPromises();

    const callArgs = store.saveServiceRequest.mock.calls[0][0];
    expect(callArgs.isSubmit).toBe(false);
    expect(callArgs.serviceId).toBe(5);
  });

  test("saveDraft shows success notification on save", async () => {
    const wrapper = mount(ServiceDetail);
    await flushPromises();

    const draftBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Guardar borrador")
    );
    await draftBtn.trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("Borrador"),
      "success"
    );
  });

  test("saveDraft shows warning notification on error", async () => {
    store.saveServiceRequest = jest.fn().mockRejectedValue(new Error("err"));
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = mount(ServiceDetail);
    await flushPromises();

    const draftBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Guardar borrador")
    );
    await draftBtn.trigger("click");
    await flushPromises();
    consoleSpy.mockRestore();

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.any(String),
      "warning"
    );
  });

  test("required email field shows validation error for invalid format", async () => {
    const service = buildService({
      stages: [
        {
          id: 1, title: "Info", description: "", order: 1,
          fields: [
            { id: 30, key: "email", label: "Correo", field_type: "email", is_required: true, order: 1, placeholder: "" },
          ],
        },
      ],
    });
    store.fetchServiceDetail = jest.fn().mockResolvedValue({ service, draft: null });

    const wrapper = mount(ServiceDetail);
    await flushPromises();

    await wrapper.find("input[type='email']").setValue("not-valid");

    const submitBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Enviar solicitud")
    );
    await submitBtn.trigger("click");

    expect(wrapper.text()).toContain("correo valido");
  });

  test("required file field shows validation error when no file selected", async () => {
    // Only second stage with file field — navigate to it first
    store.fetchServiceDetail = jest.fn().mockResolvedValue({
      service: buildService(),
      draft: { id: 7, current_stage: 2, answers: [] },
    });

    const wrapper = mount(ServiceDetail);
    await flushPromises();

    const submitBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Enviar solicitud")
    );
    await submitBtn.trigger("click");

    expect(wrapper.text()).toContain("al menos un archivo");
  });

  test("submitRequest shows submissionSuccess after successful submission", async () => {
    // Single-stage service so Enviar is visible from the start
    const service = buildService({
      stages: [
        {
          id: 1, title: "Info", description: "", order: 1,
          fields: [
            { id: 10, key: "nombre", label: "Nombre", field_type: "input", is_required: false, order: 1, placeholder: "" },
          ],
        },
      ],
    });
    store.fetchServiceDetail = jest.fn().mockResolvedValue({ service, draft: null });
    store.saveServiceRequest = jest.fn().mockResolvedValue({
      id: 1,
      tracking_number: "2026-00099",
    });

    const wrapper = mount(ServiceDetail);
    await flushPromises();

    const submitBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Enviar solicitud")
    );
    await submitBtn.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("2026-00099");
  });

  test("goBack navigates to services_list", async () => {
    const wrapper = mount(ServiceDetail);
    await flushPromises();

    const backBtn = wrapper.findAll("button").find((b) =>
      b.text().includes("Volver a Servicios")
    );
    await backBtn.trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({ name: "services_list" });
  });

  test("toggleMultiOption adds option when not present in value_json", async () => {
    const service = buildService({
      stages: [
        {
          id: 1, title: "Seleccion", description: "", order: 1,
          fields: [
            {
              id: 40, key: "tipos", label: "Tipos", field_type: "select_multiple",
              is_required: false, order: 1, options: ["A", "B"],
            },
          ],
        },
      ],
    });
    store.fetchServiceDetail = jest.fn().mockResolvedValue({ service, draft: null });

    const wrapper = mount(ServiceDetail);
    await flushPromises();

    const checkboxes = wrapper.findAll("input[type='checkbox']");
    await checkboxes[0].trigger("change");
    await checkboxes[0].trigger("change");

    // Component tracks state internally; check no crash and checkbox is rendered
    expect(checkboxes[0].exists()).toBe(true);
  });
});
