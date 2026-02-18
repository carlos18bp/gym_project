import { mount } from "@vue/test-utils";

import LegalRequestView from "@/views/legal_request/LegalRequest.vue";
const mockRouterPush = jest.fn();
const mockShowNotification = jest.fn();
const mockShowLoading = jest.fn();
const mockHideLoading = jest.fn();
const mockInit = jest.fn();
const mockCreateLegalRequest = jest.fn();
const mockUploadFilesAsync = jest.fn();
const mockGetLastCreatedRequestId = jest.fn();

let mockLegalRequestStore;

jest.mock("@/stores/legal/legal_request.js", () => ({
  __esModule: true,
  useLegalRequestStore: () => mockLegalRequestStore,
}));

jest.mock("@/shared/notification_message.js", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/shared/loading_message.js", () => ({
  __esModule: true,
  showLoading: () => mockShowLoading(),
  hideLoading: () => mockHideLoading(),
}));

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
  }),
  RouterLink: { name: "RouterLink", template: "<a><slot /></a>" },
}));

jest.mock("@headlessui/vue", () => ({
  __esModule: true,
  Combobox: { name: "Combobox", template: "<div><slot /></div>" },
  ComboboxButton: { name: "ComboboxButton", template: "<button><slot /></button>" },
  ComboboxInput: { name: "ComboboxInput", template: "<input />" },
  ComboboxLabel: { name: "ComboboxLabel", template: "<label><slot /></label>" },
  ComboboxOptions: { name: "ComboboxOptions", template: "<div><slot /></div>" },
  ComboboxOption: {
    name: "ComboboxOption",
    setup(_, { slots }) {
      return () => (slots.default ? slots.default({ active: false, selected: false }) : null);
    },
  },
}));

const SearchBarStub = {
  name: "SearchBarAndFilterBy",
  template: "<div><slot /></div>",
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const createFile = (name, type) => new File([new ArrayBuffer(8)], name, { type });

const buildStore = (overrides = {}) => ({
  init: mockInit,
  createLegalRequest: mockCreateLegalRequest,
  uploadFilesAsync: mockUploadFilesAsync,
  getLastCreatedRequestId: mockGetLastCreatedRequestId,
  legalRequestTypes: [],
  legalDisciplines: [],
  ...overrides,
});

const mountView = () =>
  mount(LegalRequestView, {
    global: {
      config: {
        warnHandler: (msg) => {
          if (msg.includes("Invalid vnode type")) {
            return;
          }
          console.warn(msg);
        },
      },
      stubs: {
        SearchBarAndFilterBy: SearchBarStub,
      },
    },
  });

const fillValidForm = (wrapper) => {
  wrapper.vm.$.setupState.formData.requestTypeId = { id: 1, name: "Consulta" };
  wrapper.vm.$.setupState.formData.disciplineId = { id: 2, name: "Civil" };
  wrapper.vm.$.setupState.formData.description = "Detalle";
};

const submitValidRequest = async () => {
  const wrapper = mountView();
  fillValidForm(wrapper);
  await wrapper.vm.$.setupState.submitHandler();
  return wrapper;
};

describe("views/legal_request/LegalRequest.vue", () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockShowNotification.mockReset();
    mockShowLoading.mockReset();
    mockHideLoading.mockReset();
    mockInit.mockReset();
    mockCreateLegalRequest.mockReset();
    mockUploadFilesAsync.mockReset();
    mockGetLastCreatedRequestId.mockReset();
    mockLegalRequestStore = buildStore();
  });

  test("loads dropdown options and toggles save button state", async () => {
    mockLegalRequestStore = buildStore({
      legalRequestTypes: [{ id: 1, name: "Consulta" }],
      legalDisciplines: [{ id: 2, name: "Civil" }],
    });

    const wrapper = mountView();

    await flushPromises();

    expect(mockInit).toHaveBeenCalled();
    expect(wrapper.vm.$.setupState.legalRequestTypes).toHaveLength(1);
    expect(wrapper.vm.$.setupState.legalDisciplines).toHaveLength(1);
    expect(wrapper.vm.$.setupState.isSaveButtonEnabled).toBeFalsy();

    wrapper.vm.$.setupState.formData.requestTypeId = { id: 1, name: "Consulta" };
    wrapper.vm.$.setupState.formData.disciplineId = { id: 2, name: "Civil" };
    wrapper.vm.$.setupState.formData.description = " descripcion ";
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.$.setupState.isSaveButtonEnabled).toBeTruthy();
  });

  test("processes file uploads, drop events, and removals", () => {
    const wrapper = mountView();

    const largeFile = createFile("large.pdf", "application/pdf");
    Object.defineProperty(largeFile, "size", {
      value: 31 * 1024 * 1024,
    });

    const invalidFile = createFile("virus.exe", "application/octet-stream");
    const pdfFile = createFile("file.pdf", "application/pdf");
    const docFile = createFile("file.doc", "application/msword");
    const docxFile = createFile(
      "file.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    const jpgFile = createFile("file.jpg", "image/jpeg");

    const changeEvent = {
      target: { files: [largeFile, invalidFile, pdfFile, docFile, docxFile, jpgFile], value: "x" },
    };

    wrapper.vm.$.setupState.handleFileChange(changeEvent);

    expect(changeEvent.target.value).toBeNull();
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("excede el límite de 30 MB"),
      "warning"
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("no es compatible"),
      "warning"
    );
    expect(wrapper.vm.$.setupState.files).toHaveLength(4);

    const dropEvent = {
      preventDefault: jest.fn(),
      dataTransfer: { files: [createFile("extra.png", "image/png")] },
    };

    wrapper.vm.$.setupState.handleDrop(dropEvent);

    expect(dropEvent.preventDefault).toHaveBeenCalled();
    expect(wrapper.vm.$.setupState.files).toHaveLength(5);

    wrapper.vm.$.setupState.removeFile(0);

    expect(wrapper.vm.$.setupState.files).toHaveLength(4);
  });

  test("submits request without files and notifies", async () => {
    mockCreateLegalRequest.mockResolvedValue(201);

    await submitValidRequest();

    expect(mockCreateLegalRequest).toHaveBeenCalledWith({
      requestTypeId: { id: 1, name: "Consulta" },
      disciplineId: { id: 2, name: "Civil" },
      description: "Detalle",
      files: [],
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("Solicitud recibida exitosamente"),
      "success"
    );
    expect([
      mockShowLoading.mock.calls.length > 0,
      mockHideLoading.mock.calls.length > 0,
      mockRouterPush.mock.calls.length > 0,
    ]).toEqual([true, true, true]);
  });

  test("submits request without files resets form", async () => {
    mockCreateLegalRequest.mockResolvedValue(201);

    const wrapper = await submitValidRequest();

    expect([
      wrapper.vm.$.setupState.formData.requestTypeId,
      wrapper.vm.$.setupState.formData.description,
      wrapper.vm.$.setupState.files.length,
    ]).toEqual(["", "", 0]);
  });

  test("submits request with files and triggers background upload", async () => {
    jest.useFakeTimers();
    const pdfFile = createFile("file.pdf", "application/pdf");
    mockCreateLegalRequest.mockResolvedValue(201);
    mockGetLastCreatedRequestId.mockReturnValue(99);

    const wrapper = mountView();

    fillValidForm(wrapper);
    wrapper.vm.$.setupState.handleFileChange({
      target: { files: [pdfFile], value: "x" },
    });

    await wrapper.vm.$.setupState.submitHandler();

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("archivo(s) se procesarán"),
      "success"
    );

    jest.runAllTimers();
    await Promise.resolve();

    expect(mockGetLastCreatedRequestId).toHaveBeenCalled();
    expect(mockUploadFilesAsync).toHaveBeenCalledWith(99, [pdfFile]);
    expect(mockRouterPush).toHaveBeenCalledWith({ name: "legal_requests_list" });
    expect(wrapper.vm.$.setupState.files).toHaveLength(0);

    jest.useRealTimers();
  });

  test("handles non-201 responses and errors", async () => {
    mockCreateLegalRequest.mockResolvedValue(400);

    const wrapper = mountView();

    wrapper.vm.$.setupState.formData.requestTypeId = { id: 1, name: "Consulta" };
    wrapper.vm.$.setupState.formData.disciplineId = { id: 2, name: "Civil" };
    wrapper.vm.$.setupState.formData.description = "Detalle";

    await wrapper.vm.$.setupState.submitHandler();

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("Error al crear la solicitud"),
      "error"
    );
    expect(mockRouterPush).not.toHaveBeenCalled();

    mockShowNotification.mockReset();
    mockCreateLegalRequest.mockRejectedValue(new Error("Boom"));
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await wrapper.vm.$.setupState.submitHandler();

    expect(consoleSpy).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("Hubo un error inesperado"),
      "error"
    );

    consoleSpy.mockRestore();
  });

  test("validates email format", () => {
    const wrapper = mountView();

    expect(wrapper.vm.$.setupState.isValidEmail("ana@example.com")).toBe(true);
    expect(wrapper.vm.$.setupState.isValidEmail("invalid")).toBe(false);
  });
});
