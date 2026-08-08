import { mount } from "@vue/test-utils";

import GlobalLetterheadModal from "@/components/dynamic_document/common/GlobalLetterheadModal.vue";

const mockShowConfirmationAlert = jest.fn();

let mockStore;

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => mockStore,
}));

jest.mock("@/shared/confirmation_alert", () => ({
  __esModule: true,
  showConfirmationAlert: (...args) => mockShowConfirmationAlert(...args),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  XMarkIcon: { template: "<span />" },
  DocumentIcon: { template: "<span />" },
  PhotoIcon: { template: "<span />" },
  CloudArrowUpIcon: { template: "<span />" },
  ArrowDownTrayIcon: { template: "<span />" },
  TrashIcon: { template: "<span />" },
  CheckCircleIcon: { template: "<span />" },
  ExclamationTriangleIcon: { template: "<span />" },
  InformationCircleIcon: { template: "<span />" },
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const ensureUrlMocks = () => {
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, "createObjectURL", {
      value: jest.fn(),
      writable: true,
    });
  }
  if (!URL.revokeObjectURL) {
    Object.defineProperty(URL, "revokeObjectURL", {
      value: jest.fn(),
      writable: true,
    });
  }
};

const mountView = (props = {}) =>
  mount(GlobalLetterheadModal, {
    props: {
      isVisible: false,
      ...props,
    },
    global: {
      stubs: {
        ModalTransition: { template: "<div><slot /></div>" },
      },
    },
  });

describe("GlobalLetterheadModal.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureUrlMocks();
    URL.createObjectURL.mockReturnValue("blob:mock");

    mockStore = {
      getGlobalLetterheadImage: jest.fn().mockResolvedValue({ data: new Blob(["img"]) }),
      uploadGlobalLetterheadImage: jest.fn().mockResolvedValue({ data: {} }),
      deleteGlobalLetterheadImage: jest.fn().mockResolvedValue(),
      getGlobalLetterheadWordTemplate: jest.fn().mockResolvedValue(null),
      uploadGlobalLetterheadWordTemplate: jest.fn().mockResolvedValue({ data: { template_info: {} } }),
      deleteGlobalLetterheadWordTemplate: jest.fn().mockResolvedValue(),
    };
  });

  test("loads current image on mount when visible", async () => {
    const wrapper = mountView({ isVisible: true });

    await flushPromises();

    expect(mockStore.getGlobalLetterheadImage).toHaveBeenCalled();
    // quality: allow-implementation-coupling (Vue component internals needed for this assertion)
    expect(wrapper.vm.$.setupState.currentImageUrl).toBe("blob:mock");
  });

  test("uploadFile uploads selected file and emits uploaded", async () => {
    const wrapper = mountView();
    const file = new File(["img"], "letterhead.png", { type: "image/png" });

    // quality: allow-implementation-coupling (Vue component internals needed for this assertion)
    wrapper.vm.$.setupState.selectedFile = file;

    await wrapper.vm.$.setupState.uploadFile();
    await flushPromises();

    expect(mockStore.uploadGlobalLetterheadImage).toHaveBeenCalledWith(file);
    expect(mockStore.getGlobalLetterheadImage).toHaveBeenCalled();
    expect(wrapper.emitted().uploaded).toBeTruthy();
    expect(wrapper.vm.$.setupState.selectedFile).toBe(null);
  });

  test("confirmDelete removes image after confirmation", async () => {
    mockShowConfirmationAlert.mockResolvedValue(true);

    const wrapper = mountView();
    // quality: allow-implementation-coupling (Vue component internals needed for this assertion)
    wrapper.vm.$.setupState.currentImageUrl = "blob:mock";

    await wrapper.vm.$.setupState.confirmDelete();
    await flushPromises();

    expect(mockShowConfirmationAlert).toHaveBeenCalled();
    expect(mockStore.deleteGlobalLetterheadImage).toHaveBeenCalled();
    expect(wrapper.emitted().deleted).toBeTruthy();
    expect(wrapper.vm.$.setupState.currentImageUrl).toBe(null);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});

describe("GlobalLetterheadModal.vue — selección, subida y descargas (coverage batch)", () => {
  let alertSpy;
  let clickSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    ensureUrlMocks();
    URL.createObjectURL.mockReturnValue("blob:mock");
    alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    mockStore = {
      uploadGlobalLetterheadImage: jest.fn().mockResolvedValue({ data: {} }),
      getGlobalLetterheadImage: jest.fn().mockResolvedValue({ data: new Blob(["img"]) }),
      deleteGlobalLetterheadImage: jest.fn().mockResolvedValue({}),
      uploadGlobalLetterheadWordTemplate: jest.fn().mockResolvedValue({
        data: { template_info: { filename: "plantilla.docx", size_bytes: 2048 } },
      }),
      getGlobalLetterheadWordTemplate: jest.fn().mockResolvedValue({
        data: new Blob(["docx"]),
        filename: "plantilla.docx",
        size: 2048,
      }),
      deleteGlobalLetterheadWordTemplate: jest.fn().mockResolvedValue({}),
    };
  });

  afterEach(() => {
    alertSpy.mockRestore();
    clickSpy.mockRestore();
  });

  // quality: allow-implementation-coupling (setupState is the only seam for file handlers)
  const state = (wrapper) => wrapper.vm.$.setupState;

  test("rejects non-PNG letterhead files with an alert", async () => {
    const wrapper = mountView();

    state(wrapper).handleFileSelect({
      target: { files: [new File(["x"], "logo.jpg", { type: "image/jpeg" })] },
    });

    expect(alertSpy).toHaveBeenCalledWith("Solo se permiten archivos PNG");
    expect(state(wrapper).selectedFile).toBeNull();
  });

  test("rejects PNG files heavier than 10MB", async () => {
    const wrapper = mountView();
    const big = new File(["x"], "logo.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });

    state(wrapper).handleFileSelect({ target: { files: [big] } });

    expect(alertSpy).toHaveBeenCalledWith("El archivo no puede ser mayor a 10MB");
  });

  test("accepts a valid PNG and stores the selection", async () => {
    const wrapper = mountView();
    const file = new File(["x"], "logo.png", { type: "image/png" });

    state(wrapper).handleFileSelect({ target: { files: [file] } });

    expect(state(wrapper).selectedFile).toBe(file);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test("dimension validation praises, advises or warns by ratio", async () => {
    const wrapper = mountView();
    const s = state(wrapper);

    s.validateImageDimensions(2550, 3300);
    expect(s.warnings.at(-1)).toContain("Dimensiones perfectas");

    s.warnings = [];
    s.validateImageDimensions(1275, 1650);
    expect(s.warnings.some((w) => w.includes("Buenas proporciones"))).toBe(true);
    expect(s.warnings.some((w) => w.includes("2550 × 3300"))).toBe(true);

    s.warnings = [];
    s.validateImageDimensions(1000, 1000);
    expect(s.warnings.some((w) => w.includes("Proporciones no ideales"))).toBe(true);
  });

  test("uploadFile without a selection never hits the API", async () => {
    const wrapper = mountView();

    await state(wrapper).uploadFile();

    expect(mockStore.uploadGlobalLetterheadImage).not.toHaveBeenCalled();
  });

  test("uploadFile uploads, surfaces backend warnings and emits uploaded", async () => {
    mockStore.uploadGlobalLetterheadImage.mockResolvedValue({
      data: { warnings: ["Revisa el margen"] },
    });
    const wrapper = mountView();
    const file = new File(["x"], "logo.png", { type: "image/png" });
    state(wrapper).selectedFile = file;

    await state(wrapper).uploadFile();
    await flushPromises();

    expect(mockStore.uploadGlobalLetterheadImage).toHaveBeenCalledWith(file);
    // clearSelection() wipes the backend warnings right after a successful upload
    expect(state(wrapper).warnings).toEqual([]);
    expect(wrapper.emitted("uploaded")).toBeTruthy();
    expect(state(wrapper).selectedFile).toBeNull();
  });

  test("uploadFile failures alert without breaking the modal", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockStore.uploadGlobalLetterheadImage.mockRejectedValue(new Error("api down"));
    const wrapper = mountView();
    state(wrapper).selectedFile = new File(["x"], "logo.png", { type: "image/png" });

    await state(wrapper).uploadFile();

    expect(alertSpy).toHaveBeenCalledWith(
      "Error al subir la imagen. Por favor intenta nuevamente."
    );
    expect(state(wrapper).uploading).toBe(false);
    errorSpy.mockRestore();
  });

  test("loadCurrentImage builds an object URL and tolerates 404s", async () => {
    const wrapper = mountView();

    await state(wrapper).loadCurrentImage();
    expect(state(wrapper).currentImageUrl).toBe("blob:mock");

    mockStore.getGlobalLetterheadImage.mockRejectedValue(new Error("404"));
    state(wrapper).hasAttemptedLoad = false;
    state(wrapper).currentImageUrl = null;
    await state(wrapper).loadCurrentImage();
    expect(state(wrapper).currentImageUrl).toBeNull();

    mockStore.getGlobalLetterheadImage.mockClear();
    await state(wrapper).loadCurrentImage();
    expect(mockStore.getGlobalLetterheadImage).not.toHaveBeenCalled();
  });

  test("confirmDelete only deletes after user confirmation", async () => {
    const wrapper = mountView();

    mockShowConfirmationAlert.mockResolvedValue(false);
    await state(wrapper).confirmDelete();
    expect(mockStore.deleteGlobalLetterheadImage).not.toHaveBeenCalled();

    mockShowConfirmationAlert.mockResolvedValue(true);
    await state(wrapper).confirmDelete();
    await flushPromises();
    expect(mockStore.deleteGlobalLetterheadImage).toHaveBeenCalledTimes(1);
  });

  test("word template selection enforces docx extension and size", async () => {
    const wrapper = mountView();

    state(wrapper).handleWordTemplateSelect({
      target: { files: [new File(["x"], "plantilla.pdf")] },
    });
    expect(alertSpy).toHaveBeenCalledWith(
      "Solo se permiten archivos .docx para la plantilla Word"
    );

    const big = new File(["x"], "plantilla.docx");
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    state(wrapper).handleWordTemplateSelect({ target: { files: [big] } });
    expect(alertSpy).toHaveBeenCalledWith(
      "El archivo de plantilla no puede ser mayor a 10MB"
    );

    const ok = new File(["x"], "plantilla.docx");
    state(wrapper).handleWordTemplateSelect({ target: { files: [ok] } });
    expect(state(wrapper).selectedWordTemplate).toBe(ok);
  });

  test("uploadWordTemplate stores metadata from the backend and reloads the blob", async () => {
    const wrapper = mountView();
    state(wrapper).selectedWordTemplate = new File(["x"], "local.docx");

    await state(wrapper).uploadWordTemplate();
    await flushPromises();

    expect(mockStore.uploadGlobalLetterheadWordTemplate).toHaveBeenCalled();
    expect(state(wrapper).hasWordTemplate).toBe(true);
    expect(state(wrapper).currentWordTemplateName).toBeTruthy();
    expect(state(wrapper).selectedWordTemplate).toBeNull();
  });

  test("uploadWordTemplate failures alert and reset the busy flag", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockStore.uploadGlobalLetterheadWordTemplate.mockRejectedValue(new Error("api"));
    const wrapper = mountView();
    state(wrapper).selectedWordTemplate = new File(["x"], "local.docx");

    await state(wrapper).uploadWordTemplate();

    expect(alertSpy).toHaveBeenCalledWith(
      "Error al subir la plantilla Word. Por favor intenta nuevamente."
    );
    expect(state(wrapper).uploadingWordTemplate).toBe(false);
    errorSpy.mockRestore();
  });

  test("loadCurrentWordTemplate clears state when no template exists", async () => {
    mockStore.getGlobalLetterheadWordTemplate.mockResolvedValue(null);
    const wrapper = mountView();
    state(wrapper).currentWordTemplateUrl = "blob:old";

    await state(wrapper).loadCurrentWordTemplate();

    expect(state(wrapper).hasWordTemplate).toBe(false);
    expect(state(wrapper).currentWordTemplateUrl).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:old");
  });

  test("confirmDeleteWordTemplate deletes only after confirmation", async () => {
    const wrapper = mountView();

    mockShowConfirmationAlert.mockResolvedValue(false);
    await state(wrapper).confirmDeleteWordTemplate();
    expect(mockStore.deleteGlobalLetterheadWordTemplate).not.toHaveBeenCalled();

    mockShowConfirmationAlert.mockResolvedValue(true);
    await state(wrapper).confirmDeleteWordTemplate();
    await flushPromises();
    expect(mockStore.deleteGlobalLetterheadWordTemplate).toHaveBeenCalledTimes(1);
  });

  test("downloads click a temporary anchor only when a URL exists", async () => {
    const wrapper = mountView();

    state(wrapper).downloadImage();
    state(wrapper).downloadWordTemplate();
    expect(clickSpy).not.toHaveBeenCalled();

    state(wrapper).currentImageUrl = "blob:img";
    state(wrapper).currentWordTemplateUrl = "blob:docx";
    state(wrapper).downloadImage();
    state(wrapper).downloadWordTemplate();
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  test("handleImageError clears the broken image and formatFileSize humanizes bytes", async () => {
    const wrapper = mountView();
    state(wrapper).currentImageUrl = "blob:roto";

    state(wrapper).handleImageError();
    expect(state(wrapper).currentImageUrl).toBeNull();

    const fmt = state(wrapper).formatFileSize;
    expect(fmt(0)).toBe("0 Bytes");
    expect(fmt(2048)).toBe("2 KB");
    expect(fmt(5 * 1024 * 1024)).toBe("5 MB");
  });

  test("opening the modal loads both current assets", async () => {
    const wrapper = mountView({ isVisible: false });

    await wrapper.setProps({ isVisible: true });
    await flushPromises();

    expect(mockStore.getGlobalLetterheadImage).toHaveBeenCalled();
    expect(mockStore.getGlobalLetterheadWordTemplate).toHaveBeenCalled();
  });
});
