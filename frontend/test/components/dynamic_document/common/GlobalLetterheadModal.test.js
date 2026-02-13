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
    expect(wrapper.vm.$.setupState.currentImageUrl).toBe("blob:mock");
  });

  test("uploadFile uploads selected file and emits uploaded", async () => {
    const wrapper = mountView();
    const file = new File(["img"], "letterhead.png", { type: "image/png" });

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
