import { shallowMount } from "@vue/test-utils";

import DocumentListTable from "@/components/dynamic_document/common/DocumentListTable.vue";

const mockRouterPush = jest.fn();
const mockUserInit = jest.fn();
const mockFetchDocuments = jest.fn();
const mockHandlePreviewDocument = jest.fn();
const mockOpenModal = jest.fn();
const mockCloseModal = jest.fn();
// Captures the emit proxy DocumentListTable hands to useDocumentActions so
// tests can simulate a document action requesting a refresh.
const mockCapturedActionEmit = { fn: null };

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
  useDocumentActions: (documentStore, userStore, emit) => {
    mockCapturedActionEmit.fn = emit;
    return {
      handlePreviewDocument: (...args) => mockHandlePreviewDocument(...args),
      deleteDocument: jest.fn(),
      downloadPDFDocument: jest.fn(),
      downloadWordDocument: jest.fn(),
      copyDocument: jest.fn(),
      publishDocument: jest.fn(),
      moveToDraft: jest.fn(),
      toggleSharedEdit: jest.fn(),
      formalizeDocument: jest.fn(),
      signDocument: jest.fn(),
      downloadSignedDocument: jest.fn(),
    };
  },
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
      allMinutas: [],
      progressAndCompletedDocumentsByClient: jest.fn(() => []),
      documents: [],
      pagination: { totalPages: 1 },
      lastUpdatedDocumentId: null,
    };
    mockFetchDocuments.mockResolvedValue();
  });

  test("fetches all minutas on mount without a per-creator filter", async () => {
    const wrapper = mountView();

    await flushPromises();

    expect(mockUserInit).toHaveBeenCalled();
    expect(mockFetchDocuments).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      forceRefresh: true,
      states: ["Draft", "Published"],
      search: "",
      tagId: null,
      dateFrom: "",
      dateTo: "",
      sortBy: "recent",
    });
    expect(mockFetchDocuments.mock.calls[0][0]).not.toHaveProperty("lawyerId");
    expect(wrapper.exists()).toBe(true);
  });

  test("renders informational 'Creado por' column in minutas context", async () => {
    const wrapper = mountView({
      promptDocuments: [
        { id: 50, title: "Minuta Compartida", state: "Published", created_by_name: "Ada Lovelace", tags: [] },
      ],
    });

    await flushPromises();

    const thTexts = wrapper.findAll("th").map((th) => th.text().trim());
    expect(thTexts).toContain("Creado por");
    expect(wrapper.text()).toContain("Ada Lovelace");
  });

  test("'Mías' scope re-fetches minutas scoped to the current lawyer", async () => {
    const wrapper = mountView();

    await flushPromises();
    mockFetchDocuments.mockClear();

    const mineBtn = wrapper
      .findAll("button")
      .find((btn) => btn.text().trim() === "Mías");
    expect(mineBtn).toBeTruthy();

    await mineBtn.trigger("click");
    await flushPromises();

    const lastCall = mockFetchDocuments.mock.calls.at(-1)[0];
    expect(lastCall.lawyerId).toBe(7);
    expect(lastCall.states).toEqual(["Draft", "Published"]);
  });

  test("'Compartidas' scope re-fetches minutas flagged for shared edit", async () => {
    const wrapper = mountView();

    await flushPromises();
    mockFetchDocuments.mockClear();

    const sharedBtn = wrapper
      .findAll("button")
      .find((btn) => btn.text().trim() === "Compartidas");
    expect(sharedBtn).toBeTruthy();

    await sharedBtn.trigger("click");
    await flushPromises();

    const lastCall = mockFetchDocuments.mock.calls.at(-1)[0];
    expect(lastCall.shared).toBe(true);
    expect(lastCall).not.toHaveProperty("lawyerId");
    expect(lastCall.states).toEqual(["Draft", "Published"]);
  });

  test("'Todas' scope re-fetches minutas without per-creator or shared filters", async () => {
    const wrapper = mountView();

    await flushPromises();

    const buttons = wrapper.findAll("button");
    const mineBtn = buttons.find((btn) => btn.text().trim() === "Mías");
    const allBtn = buttons.find((btn) => btn.text().trim() === "Todas");

    await mineBtn.trigger("click");
    await flushPromises();
    mockFetchDocuments.mockClear();

    await allBtn.trigger("click");
    await flushPromises();

    const lastCall = mockFetchDocuments.mock.calls.at(-1)[0];
    expect(lastCall).not.toHaveProperty("lawyerId");
    expect(lastCall).not.toHaveProperty("shared");
  });

  test("action-driven refresh re-fetches preserving the active minutas scope", async () => {
    const wrapper = mountView();

    await flushPromises();

    // Activate the "Mías" scope, then simulate a document action (publish,
    // copy, delete…) emitting 'refresh' through the actionEmit proxy.
    const mineBtn = wrapper
      .findAll("button")
      .find((btn) => btn.text().trim() === "Mías");
    await mineBtn.trigger("click");
    await flushPromises();
    mockFetchDocuments.mockClear();

    mockCapturedActionEmit.fn("refresh");
    await flushPromises();

    const lastCall = mockFetchDocuments.mock.calls.at(-1)[0];
    expect(lastCall.lawyerId).toBe(7);
    expect(lastCall.states).toEqual(["Draft", "Published"]);
    // The parent is still notified so tab badges stay in sync.
    expect(wrapper.emitted("refresh")).toBeTruthy();
  });

  test("shows 'Compartida' badge for minutas flagged for shared edit", async () => {
    const wrapper = mountView({
      promptDocuments: [
        {
          id: 51,
          title: "Minuta Colaborativa",
          state: "Published",
          created_by_name: "Grace Hopper",
          allow_shared_edit: true,
          tags: [],
        },
      ],
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Compartida");
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

  const SUMMARY_COLUMNS = [
    "Contraparte", "Objeto", "Valor", "Plazo",
    "Fecha Suscripción", "Fecha Inicio", "Fecha Terminación",
  ];

  const FAKE_DOC = { id: 999, title: "Test Minuta", state: "Published", tags: [] };

  test("hides summary columns when cardType is 'lawyer' and context is 'legal-documents'", async () => {
    // promptDocuments bypasses store logic and forces the table to render
    const wrapper = mountView({ promptDocuments: [FAKE_DOC] });
    await flushPromises();

    const thTexts = wrapper.findAll("th").map((th) => th.text().trim());
    SUMMARY_COLUMNS.forEach((col) => expect(thTexts).not.toContain(col));
  });

  test("shows summary columns when context is not 'legal-documents'", async () => {
    const wrapper = mountView({ context: "my-documents", promptDocuments: [FAKE_DOC] });
    await flushPromises();

    const thTexts = wrapper.findAll("th").map((th) => th.text().trim());
    SUMMARY_COLUMNS.forEach((col) => expect(thTexts).toContain(col));
  });

  test("renders Informativo suffix in status badge for informative documents", async () => {
    const wrapper = mountView({
      promptDocuments: [
        { id: 10, title: "Aviso Legal", state: "Completed", signature_type: "informative", tags: [] },
      ],
    });

    await flushPromises();

    expect(wrapper.text()).toContain("(Informativo)");
  });

  test("renders Solo Emisor suffix in status badge for issuer_only documents", async () => {
    const wrapper = mountView({
      promptDocuments: [
        { id: 11, title: "Terminacion", state: "PendingSignatures", signature_type: "issuer_only", tags: [] },
      ],
    });

    await flushPromises();

    expect(wrapper.text()).toContain("(Solo Emisor)");
  });

  test("does not render signature type suffix for normal documents", async () => {
    const wrapper = mountView({
      promptDocuments: [
        { id: 12, title: "Contrato Normal", state: "PendingSignatures", signature_type: "normal", tags: [] },
      ],
    });

    await flushPromises();

    expect(wrapper.text()).not.toContain("(Informativo)");
    expect(wrapper.text()).not.toContain("(Solo Emisor)");
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

    // quality: allow-implementation-coupling (Vue component internals needed for this assertion)
    expect(wrapper.vm.$.setupState.selectedDocuments).toEqual([1, 2]);

    await headerCheckbox.trigger("change");
    expect(wrapper.vm.$.setupState.selectedDocuments).toEqual([]);
  });
});
