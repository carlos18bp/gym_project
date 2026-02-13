import { shallowMount } from "@vue/test-utils";

import DocumentInProgressByClientListTable from "@/components/dynamic_document/lawyer/DocumentInProgressByClientListTable.vue";

const mockRouterPush = jest.fn();
const mockHandlePreviewDocument = jest.fn();
const mockDownloadPDFDocument = jest.fn();
const mockDownloadWordDocument = jest.fn();
const mockDeleteDocument = jest.fn();

let mockUserStore;
let mockDocumentStore;

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: (...args) => mockRouterPush(...args),
  }),
}));

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => mockUserStore,
}));

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => mockDocumentStore,
}));

jest.mock("@/components/dynamic_document/cards/menuOptionsHelper", () => ({
  __esModule: true,
  getMenuOptionsForCardType: () => [],
}));

jest.mock("@/components/dynamic_document/cards", () => ({
  __esModule: true,
  useCardModals: () => ({
    activeModals: {
      edit: { isOpen: false, document: null },
      email: { isOpen: false, document: null },
      letterhead: { isOpen: false, document: null },
      relationships: { isOpen: false, document: null },
    },
    openModal: jest.fn(),
    closeModal: jest.fn(),
    getUserRole: () => "lawyer",
  }),
  useDocumentActions: () => ({
    handlePreviewDocument: (...args) => mockHandlePreviewDocument(...args),
    deleteDocument: (...args) => mockDeleteDocument(...args),
    downloadPDFDocument: (...args) => mockDownloadPDFDocument(...args),
    downloadWordDocument: (...args) => mockDownloadWordDocument(...args),
  }),
  EditDocumentModal: { template: "<div />" },
  SendDocumentModal: { template: "<div />" },
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  MagnifyingGlassIcon: { template: "<span />" },
  FunnelIcon: { template: "<span />" },
  ChevronDownIcon: { template: "<span />" },
  ArrowDownTrayIcon: { template: "<span />" },
  EllipsisVerticalIcon: { template: "<span />" },
  CubeTransparentIcon: { template: "<span />" },
  XMarkIcon: { template: "<span />" },
  DocumentTextIcon: { template: "<span />" },
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

const mountView = (props = {}) =>
  shallowMount(DocumentInProgressByClientListTable, {
    props: {
      searchQuery: "",
      selectedTags: [],
      ...props,
    },
    global: {
      stubs: {
        Menu: { template: "<div><slot /></div>" },
        MenuButton: { template: "<button><slot /></button>" },
        MenuItems: { template: "<div><slot /></div>" },
        MenuItem: MenuItemStub,
        EditDocumentModal: { template: "<div />" },
        SendDocumentModal: { template: "<div />" },
        LetterheadModal: { template: "<div />" },
        DocumentRelationshipsModal: { template: "<div />" },
        DocumentActionsModal: { template: "<div />" },
        Teleport: true,
      },
    },
  });

describe("DocumentInProgressByClientListTable.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStore = {
      currentUser: { id: 1, role: "lawyer", email: "lawyer@example.com" },
      init: jest.fn().mockResolvedValue(),
    };
    mockDocumentStore = {
      documents: [],
      init: jest.fn().mockResolvedValue(),
      fetchDocumentsForTab: jest.fn().mockResolvedValue({
        items: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
      }),
    };
  });

  test("calls fetchDocumentsForTab with Progress state on mount", async () => {
    mountView();
    await flushPromises();

    expect(mockDocumentStore.fetchDocumentsForTab).toHaveBeenCalledWith(
      expect.objectContaining({ state: "Progress", page: 1, limit: 10 })
    );
  });

  test("shows loading spinner while fetching and hides it after", async () => {
    let resolvePromise;
    mockDocumentStore.fetchDocumentsForTab.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    const wrapper = mountView();
    await flushPromises();

    // While loading: spinner visible, empty state hidden
    expect(wrapper.find(".animate-spin").exists()).toBe(true);
    expect(wrapper.text()).toContain("Cargando documentos...");
    expect(wrapper.text()).not.toContain("No hay documentos en progreso");

    // Resolve the fetch
    resolvePromise({
      items: [],
      totalItems: 0,
      totalPages: 0,
      currentPage: 1,
    });
    await flushPromises();

    // After loading: spinner hidden, empty state visible
    expect(wrapper.find(".animate-spin").exists()).toBe(false);
    expect(wrapper.text()).toContain("No hay documentos en progreso");
  });

  test("hides empty state when documents are loaded", async () => {
    mockDocumentStore.fetchDocumentsForTab.mockResolvedValue({
      items: [
        { id: 1, title: "Doc en Progreso", state: "Progress", created_by: 2 },
      ],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
    });

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.find(".animate-spin").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("No hay documentos en progreso");
    expect(wrapper.vm.$.setupState.tabDocuments).toHaveLength(1);
  });

  test("sets tabDocuments to empty array on fetch error", async () => {
    mockDocumentStore.fetchDocumentsForTab.mockRejectedValue(
      new Error("Network error")
    );

    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.vm.$.setupState.tabDocuments).toEqual([]);
    expect(wrapper.vm.$.setupState.isLoading).toBe(false);
  });

  test("updates pagination state from API response", async () => {
    mockDocumentStore.fetchDocumentsForTab.mockResolvedValue({
      items: [{ id: 1, title: "Doc 1", state: "Progress", created_by: 2 }],
      totalItems: 25,
      totalPages: 3,
      currentPage: 1,
    });

    const wrapper = mountView();
    await flushPromises();

    const pagination = wrapper.vm.$.setupState.tabPagination;
    expect(pagination.totalItems).toBe(25);
    expect(pagination.totalPages).toBe(3);
    expect(pagination.currentPage).toBe(1);
  });
});
