import { shallowMount } from "@vue/test-utils";

import DocumentListTable from "@/components/dynamic_document/common/DocumentListTable.vue";

const mockRouterPush = jest.fn();
const mockUserInit = jest.fn();
const mockFetchDocuments = jest.fn();
const mockHandlePreviewDocument = jest.fn();
const mockOpenModal = jest.fn();
const mockCloseModal = jest.fn();

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
      signatures: { isOpen: false, document: null },
      letterhead: { isOpen: false, document: null },
      relationships: { isOpen: false, document: null },
      permissions: { isOpen: false, document: null },
      email: { isOpen: false, document: null },
      edit: { isOpen: false, document: null },
    },
    openModal: (...args) => mockOpenModal(...args),
    closeModal: (...args) => mockCloseModal(...args),
  }),
  useDocumentActions: () => ({
    handlePreviewDocument: (...args) => mockHandlePreviewDocument(...args),
    deleteDocument: jest.fn(),
    downloadPDFDocument: jest.fn(),
    downloadWordDocument: jest.fn(),
    copyDocument: jest.fn(),
    publishDocument: jest.fn(),
    moveToDraft: jest.fn(),
    formalizeDocument: jest.fn(),
    signDocument: jest.fn(),
    downloadSignedDocument: jest.fn(),
  }),
  EditDocumentModal: { template: "<div />" },
  SendDocumentModal: { template: "<div />" },
  DocumentSignaturesModal: { template: "<div />" },
  DocumentPermissionsModal: { template: "<div />" },
}));

jest.mock("@/shared/document_utils", () => {
  const { ref } = require("vue");
  return {
    __esModule: true,
    showPreviewModal: ref(false),
    previewDocumentData: ref({}),
    openPreviewModal: jest.fn(),
  };
});

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  MagnifyingGlassIcon: { template: "<span />" },
  FunnelIcon: { template: "<span />" },
  ChevronDownIcon: { template: "<span />" },
  ArrowsUpDownIcon: { template: "<span />" },
  ArrowDownTrayIcon: { template: "<span />" },
  DocumentTextIcon: { template: "<span />" },
  EllipsisVerticalIcon: { template: "<span />" },
  LinkIcon: { template: "<span />" },
  ChevronLeftIcon: { template: "<span />" },
  ChevronRightIcon: { template: "<span />" },
  XMarkIcon: { template: "<span />" },
  TagIcon: { template: "<span />" },
  CubeTransparentIcon: { template: "<span />" },
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
  shallowMount(DocumentListTable, {
    props: {
      cardType: "lawyer",
      context: "legal-documents",
      ...props,
    },
    global: {
      stubs: {
        Menu: { template: "<div><slot /></div>" },
        MenuButton: { template: "<button><slot /></button>" },
        MenuItems: { template: "<div><slot /></div>" },
        MenuItem: MenuItemStub,
        DocumentPreviewModal: { template: "<div />" },
        DocumentActionsModal: { template: "<div />" },
        LetterheadModal: { template: "<div />" },
        DocumentRelationshipsModal: { template: "<div />" },
        Teleport: true,
      },
    },
  });

describe("DocumentListTable.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStore = {
      currentUser: { id: 7, role: "lawyer" },
      init: (...args) => mockUserInit(...args),
    };
    mockDocumentStore = {
      fetchDocuments: (...args) => mockFetchDocuments(...args),
      getDocumentsByLawyerId: jest.fn(() => []),
      progressAndCompletedDocumentsByClient: jest.fn(() => []),
      documents: [],
      pagination: { totalPages: 1 },
      lastUpdatedDocumentId: null,
    };
    mockFetchDocuments.mockResolvedValue();
  });

  test("fetches lawyer documents on mount with expected filters", async () => {
    const wrapper = mountView();

    await flushPromises();

    expect(mockUserInit).toHaveBeenCalled();
    expect(mockFetchDocuments).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      forceRefresh: true,
      lawyerId: 7,
      states: ["Draft", "Published"],
    });
    expect(wrapper.exists()).toBe(true);
  });

  test("updates search query and emits update", async () => {
    const wrapper = mountView({
      promptDocuments: [{ id: 1, title: "Contrato" }],
      searchQuery: "",
    });

    const searchInput = wrapper.find("input[placeholder='Buscar...']");
    await searchInput.setValue("Acuerdo");

    const emissions = wrapper.emitted("update:searchQuery");
    expect(emissions[emissions.length - 1]).toEqual(["Acuerdo"]);
  });

  test("toggle all selection selects and clears document IDs", async () => {
    const wrapper = mountView({
      promptDocuments: [
        { id: 1, title: "Doc 1", state: "Draft" },
        { id: 2, title: "Doc 2", state: "Draft" },
      ],
    });

    await flushPromises();

    const headerCheckbox = wrapper.find("thead input[type='checkbox']");
    await headerCheckbox.trigger("change");

    expect(wrapper.vm.$.setupState.selectedDocuments).toEqual([1, 2]);

    await headerCheckbox.trigger("change");
    expect(wrapper.vm.$.setupState.selectedDocuments).toEqual([]);
  });
});
