import { mount } from "@vue/test-utils";

import LetterheadModal from "@/components/dynamic_document/common/LetterheadModal.vue";

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
  mount(LetterheadModal, {
    props: {
      isVisible: false,
      document: { id: 1, title: "Doc" },
      ...props,
    },
    global: {
      stubs: {
        ModalTransition: { template: "<div><slot /></div>" },
      },
    },
  });

describe("LetterheadModal.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureUrlMocks();
    URL.createObjectURL.mockReset();
    URL.revokeObjectURL.mockReset();

    mockStore = {
      getLetterheadImage: jest.fn().mockResolvedValue({ data: new Blob(["img"]) }),
      uploadLetterheadImage: jest.fn().mockResolvedValue({ data: {} }),
      deleteLetterheadImage: jest.fn().mockResolvedValue(),
      getDocumentLetterheadWordTemplate: jest
        .fn()
        .mockResolvedValue({
          data: new Blob(["doc"]),
          headers: { "content-disposition": "attachment; filename=template.docx" },
        }),
      uploadDocumentLetterheadWordTemplate: jest
        .fn()
        .mockResolvedValue({ data: { template_info: { filename: "template.docx" } } }),
      deleteDocumentLetterheadWordTemplate: jest.fn().mockResolvedValue(),
    };
  });

  test("loads current image and word template when visible", async () => {
    URL.createObjectURL
      .mockReturnValueOnce("blob:image")
      .mockReturnValueOnce("blob:doc");

    const wrapper = mountView({ isVisible: true });

    await flushPromises();

    expect(mockStore.getLetterheadImage).toHaveBeenCalledWith(1);
    expect(mockStore.getDocumentLetterheadWordTemplate).toHaveBeenCalledWith(1, "blob");
    expect(wrapper.vm.$.setupState.currentImageUrl).toBe("blob:image");
    expect(wrapper.vm.$.setupState.currentWordTemplateName).toBe("template.docx");
  });

  test("uploadFile uploads image and emits uploaded", async () => {
    URL.createObjectURL.mockReturnValue("blob:image");

    const wrapper = mountView();
    const file = new File(["img"], "letterhead.png", { type: "image/png" });

    wrapper.vm.$.setupState.selectedFile = file;

    await wrapper.vm.$.setupState.uploadFile();
    await flushPromises();

    expect(mockStore.uploadLetterheadImage).toHaveBeenCalledWith(1, file);
    expect(wrapper.emitted().uploaded).toBeTruthy();
    expect(wrapper.vm.$.setupState.selectedFile).toBe(null);
  });

  test("confirmDelete removes image after confirmation", async () => {
    mockShowConfirmationAlert.mockResolvedValue(true);
    const wrapper = mountView();

    wrapper.vm.$.setupState.currentImageUrl = "blob:current";

    await wrapper.vm.$.setupState.confirmDelete();
    await flushPromises();

    expect(mockStore.deleteLetterheadImage).toHaveBeenCalledWith(1);
    expect(wrapper.emitted().deleted).toBeTruthy();
    expect(wrapper.vm.$.setupState.currentImageUrl).toBe(null);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:current");
  });

  test("handleWordTemplateSelect rejects non-docx files", async () => {
    const wrapper = mountView();
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

    const file = new File(["data"], "template.pdf", { type: "application/pdf" });

    await wrapper.vm.$.setupState.handleWordTemplateSelect({
      target: { files: [file] },
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Solo se permiten archivos .docx para la plantilla Word"
    );
    expect(wrapper.vm.$.setupState.selectedWordTemplate).toBe(null);

    alertSpy.mockRestore();
  });

  test("uploadWordTemplate uploads and refreshes template info", async () => {
    URL.createObjectURL.mockReturnValue("blob:doc");

    const wrapper = mountView();
    const file = new File(["doc"], "template.docx", { type: "application/vnd.openxmlformats" });

    wrapper.vm.$.setupState.selectedWordTemplate = file;

    await wrapper.vm.$.setupState.uploadWordTemplate();
    await flushPromises();

    expect(mockStore.uploadDocumentLetterheadWordTemplate).toHaveBeenCalledWith(1, file);
    expect(wrapper.vm.$.setupState.hasWordTemplate).toBe(true);
    expect(wrapper.vm.$.setupState.selectedWordTemplate).toBe(null);
    expect(wrapper.vm.$.setupState.currentWordTemplateUrl).toBe("blob:doc");
  });
});
