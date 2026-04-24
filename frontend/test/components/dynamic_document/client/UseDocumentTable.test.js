import { mount } from "@vue/test-utils";

import UseDocumentTable from "@/components/dynamic_document/client/UseDocumentTable.vue";
import {
  showPreviewModal as mockShowPreviewModal,
  previewDocumentData as mockPreviewDocumentData,
  getPreviewContentWithFormattedVariables as mockGetPreviewFn,
} from "@/shared/document_utils";

const mockRouterPush = jest.fn();

let mockDocumentStore;
let mockUserStore;

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: (...args) => mockRouterPush(...args),
  }),
}));

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => mockDocumentStore,
}));

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => mockUserStore,
}));

jest.mock("@/shared/document_utils", () => ({
  __esModule: true,
  showPreviewModal: { value: false },
  previewDocumentData: { value: { title: "", content: "" } },
  getPreviewContentWithFormattedVariables: jest.fn(() => "<p>formatted</p>"),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  MagnifyingGlassIcon: { template: "<span />" },
  FunnelIcon: { template: "<span />" },
  ChevronDownIcon: { template: "<span />" },
  EllipsisVerticalIcon: { template: "<span />" },
  CubeTransparentIcon: { template: "<span />" },
  XMarkIcon: { template: "<span />" },
  DocumentTextIcon: { template: "<span />" },
  ArrowLeftIcon: { template: "<span />" },
  ChevronLeftIcon: { template: "<span />" },
  ChevronRightIcon: { template: "<span />" },
}));

const MenuItemStub = {
  name: "MenuItem",
  setup(_, { slots }) {
    return () => (slots.default ? slots.default({ active: false }) : null);
  },
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const findButtonByText = (wrapper, text) =>
  wrapper
    .findAll("button")
    .find((button) => (button.text() || "").includes(text));

const mountView = () =>
  mount(UseDocumentTable, {
    global: {
      stubs: {
        Menu: { template: "<div><slot /></div>" },
        MenuButton: { template: "<button><slot /></button>" },
        MenuItems: { template: "<div><slot /></div>" },
        MenuItem: MenuItemStub,
        UseDocumentByClient: { template: "<div data-test='use-modal' />" },
        ModalTransition: { template: "<div><slot /></div>" },
        DocumentActionsModal: { template: "<div data-test='actions-modal' />" },
        DocumentPreviewModal: { template: "<div data-test='preview-modal' />" },
        Teleport: true,
      },
    },
  });

describe("UseDocumentTable.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowPreviewModal.value = false;
    mockPreviewDocumentData.value = { title: "", content: "" };
    mockGetPreviewFn.mockClear();
    mockUserStore = { currentUser: { role: "client" } };
    mockDocumentStore = {
      documents: [],
      init: jest.fn().mockResolvedValue(),
      fetchDocumentsForTab: jest.fn().mockResolvedValue({
        items: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
      }),
      fetchDocumentById: jest.fn(),
      publishedDocumentsUnassigned: [],
      selectedDocument: { id: 99 },
    };
  });

  test("initializes tab data via fetchDocumentsForTab on mount", async () => {
    const wrapper = mountView();

    await flushPromises();

    expect(mockDocumentStore.fetchDocumentsForTab).toHaveBeenCalled();
    expect(wrapper.exists()).toBe(true);
  });

  test("emits go-back when clicking back button", async () => {
    const wrapper = mountView();

    await findButtonByText(wrapper, "Volver a Mis Documentos").trigger("click");

    expect(wrapper.emitted("go-back")).toBeTruthy();
  });

  test("opens actions modal on row click", async () => {
    mockDocumentStore.fetchDocumentsForTab.mockResolvedValue({
      items: [{ id: 1, title: "Plantilla", state: "Published", assigned_to: null }],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
    });

    const wrapper = mountView();
    await flushPromises();

    await wrapper.find("tbody tr").trigger("click");

    // quality: allow-implementation-coupling (Vue component internals needed for this assertion)
    const state = wrapper.vm.$.setupState;
    expect(state.showActionsModal).toBe(true);
    expect(state.selectedDocumentForActions).toEqual(
      expect.objectContaining({ id: 1, title: "Plantilla" })
    );
  });

  test("handleModalAction with useTemplate opens use modal", async () => {
    mockDocumentStore.fetchDocumentsForTab.mockResolvedValue({
      items: [{ id: 5, title: "Plantilla X", state: "Published" }],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
    });

    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (calling internal handler directly)
    const state = wrapper.vm.$.setupState;
    await state.handleModalAction("useTemplate", { id: 5 });

    expect(state.showActionsModal).toBe(false);
    expect(state.showUseModal).toBe(true);
    expect(state.selectedTemplateId).toBe(5);
    expect(mockDocumentStore.selectedDocument).toBe(null);
  });

  test("handleModalAction with preview calls getPreviewContentWithFormattedVariables", async () => {
    const doc = { id: 7, title: "Contrato", state: "Published", content: "<p>Hola {{ name }}</p>" };
    mockDocumentStore.fetchDocumentsForTab.mockResolvedValue({
      items: [doc],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
    });

    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (calling internal handler directly)
    await wrapper.vm.$.setupState.handleModalAction("preview", doc);

    expect(mockGetPreviewFn).toHaveBeenCalledWith(doc);
    expect(mockShowPreviewModal.value).toBe(true);
    expect(mockPreviewDocumentData.value.title).toBe("Contrato");
  });

  test("handlePreviewTemplate fetches content when missing", async () => {
    const partialDoc = { id: 10, title: "Sin contenido", state: "Published" };
    const fullDoc = { id: 10, title: "Sin contenido", state: "Published", content: "<p>Full</p>" };
    mockDocumentStore.fetchDocumentById.mockResolvedValue(fullDoc);
    mockDocumentStore.fetchDocumentsForTab.mockResolvedValue({
      items: [partialDoc],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
    });

    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (calling internal handler directly)
    await wrapper.vm.$.setupState.handlePreviewTemplate(partialDoc);

    expect(mockDocumentStore.fetchDocumentById).toHaveBeenCalledWith(10, true);
    expect(mockGetPreviewFn).toHaveBeenCalledWith(fullDoc);
    expect(mockShowPreviewModal.value).toBe(true);
  });
});
