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
// Holder for the action fns returned by the mocked useDocumentActions, so
// tests can assert handleMenuAction dispatches to the right action.
const mockActions = {};

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
    Object.assign(mockActions, {
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
    });
    return mockActions;
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

describe("DocumentListTable.vue — menú de acciones y helpers (coverage batch)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStore = {
      currentUser: { id: 7, role: "lawyer" },
      init: (...args) => mockUserInit(...args),
    };
    mockDocumentStore = {
      fetchDocuments: (...args) => mockFetchDocuments(...args),
      fetchDocumentById: jest.fn().mockResolvedValue({ id: 999, title: "Full" }),
      allMinutas: [],
      progressAndCompletedDocumentsByClient: jest.fn(() => []),
      documents: [],
      pagination: { totalPages: 1, currentPage: 1, itemsPerPage: 10, totalItems: 0 },
      lastUpdatedDocumentId: null,
      selectedDocument: null,
    };
    mockFetchDocuments.mockResolvedValue();
  });

  const DOC = { id: 999, title: "Doc Menu", state: "Published", tags: [] };

  // quality: allow-implementation-coupling (handleMenuAction is only reachable
  // through stubbed modal emits; setupState matches the file's existing pattern)
  const dispatch = (wrapper, action, doc = DOC) =>
    wrapper.vm.$.setupState.handleMenuAction(action, doc);

  test("preview action delegates to handlePreviewDocument", async () => {
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, "preview");

    expect(mockHandlePreviewDocument).toHaveBeenCalledWith(DOC);
  });

  test("edit action in minutas context opens the rename-only modal", async () => {
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, "edit");

    expect(mockOpenModal).toHaveBeenCalledWith("edit", DOC, {
      userRole: "lawyer",
      renameOnly: true,
    });
  });

  test("edit action outside minutas keeps the full edit modal", async () => {
    const wrapper = mountView({ context: "my-documents", cardType: "client", promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, "edit");

    expect(mockOpenModal).toHaveBeenCalledWith("edit", DOC, { userRole: "lawyer" });
  });

  test("editForm on a minuta loads the full document and jumps to variables config", async () => {
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, "editForm");
    await flushPromises();

    expect(mockDocumentStore.fetchDocumentById).toHaveBeenCalledWith(999, true);
    expect(mockDocumentStore.selectedDocument).toEqual({ id: 999, title: "Full" });
    expect(mockRouterPush).toHaveBeenCalledWith(
      "/dynamic_document_dashboard/lawyer/variables-config"
    );
  });

  test("editForm failures are logged without navigating", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();
    mockDocumentStore.fetchDocumentById.mockRejectedValue(new Error("api down"));

    await dispatch(wrapper, "editForm");
    await flushPromises();

    expect(mockRouterPush).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("editForm outside minutas opens the client edit modal", async () => {
    const wrapper = mountView({ context: "my-documents", cardType: "client", promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, "editForm");

    expect(mockOpenModal).toHaveBeenCalledWith("edit", DOC, { userRole: "client" });
  });

  test("editDocument routes minutas to the lawyer editor", async () => {
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, "editDocument");

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/dynamic_document_dashboard/lawyer/editor/edit/999"
    );
  });

  test("editDocument routes client documents to the client editor", async () => {
    const wrapper = mountView({ context: "my-documents", cardType: "client", promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, "editDocument");

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/dynamic_document_dashboard/client/editor/edit/999"
    );
  });

  test.each([
    ["permissions", "permissions"],
    ["relationships", "relationships"],
    ["letterhead", "letterhead"],
    ["viewSignatures", "signatures"],
    ["signatures", "signatures"],
  ])("%s action opens the %s modal", async (action, modal) => {
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, action);

    expect(mockOpenModal).toHaveBeenCalledWith(modal, DOC);
  });

  test.each([
    ["publish", "publishDocument"],
    ["draft", "moveToDraft"],
    ["move-to-draft", "moveToDraft"],
    ["toggleSharedEdit", "toggleSharedEdit"],
    ["formalize", "formalizeDocument"],
    ["sign", "signDocument"],
  ])("%s action dispatches to %s", async (action, fnName) => {
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, action);

    expect(mockActions[fnName]).toHaveBeenCalledWith(DOC);
  });

  test("tag chips use the backend color when provided and an id-derived one otherwise", async () => {
    const wrapper = mountView({
      promptDocuments: [
        {
          id: 1,
          title: "Etiquetado",
          state: "Draft",
          tags: [
            { id: 1, name: "Rojo", color: "red" },
            { id: 7, name: "Derivado" },
          ],
        },
      ],
    });
    await flushPromises();

    const chips = wrapper.findAll("span.rounded-full");
    const rojo = chips.find((c) => c.text() === "Rojo");
    const derivado = chips.find((c) => c.text() === "Derivado");
    expect(rojo.classes()).toContain("bg-red-100");
    expect(derivado.classes()).toContain("bg-pink-100");
  });

  test("summary columns format dates and show placeholders when empty", async () => {
    const wrapper = mountView({
      context: "my-documents",
      cardType: "client",
      promptDocuments: [
        {
          id: 2,
          title: "Con Resumen",
          state: "Completed",
          tags: [],
          summary_value: "1000",
          summary_value_currency: "COP",
          summary_term: "12 meses",
          summary_subscription_date: "2026-05-10",
        },
      ],
    });
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain("12 meses");
    expect(text).toContain("2026");
    expect(text).toContain("may");
  });

  test("pagination windows collapse with ellipsis on long lists", async () => {
    const docs = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      title: `Doc ${i + 1}`,
      state: "Draft",
      tags: [],
    }));
    const wrapper = mountView({ promptDocuments: docs });
    await flushPromises();

    // quality: allow-implementation-coupling (displayedPages drives button rendering)
    expect(wrapper.vm.$.setupState.displayedPages).toEqual([1, 2, 3, 4, 5, "...", 10]);

    wrapper.vm.$.setupState.currentPage = 6;
    await flushPromises();
    expect(wrapper.vm.$.setupState.displayedPages).toEqual([1, "...", 5, 6, 7, "...", 10]);

    wrapper.vm.$.setupState.currentPage = 9;
    await flushPromises();
    expect(wrapper.vm.$.setupState.displayedPages).toEqual([1, "...", 6, 7, 8, 9, 10]);
  });

  test("the +N tags button opens the tags modal for the document", async () => {
    const wrapper = mountView({
      promptDocuments: [
        {
          id: 3,
          title: "Muchas Etiquetas",
          state: "Draft",
          tags: [
            { id: 1, name: "A" },
            { id: 2, name: "B" },
            { id: 3, name: "C" },
          ],
        },
      ],
    });
    await flushPromises();

    const moreBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("+1"));
    await moreBtn.trigger("click");

    // quality: allow-implementation-coupling (modal open state drives a stubbed teleport)
    expect(wrapper.vm.$.setupState.showTagsModal).toBe(true);
  });
});

describe("DocumentListTable.vue — descargas, copia y filtros locales (coverage batch 2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStore = {
      currentUser: { id: 7, role: "lawyer" },
      init: (...args) => mockUserInit(...args),
    };
    mockDocumentStore = {
      fetchDocuments: (...args) => mockFetchDocuments(...args),
      fetchDocumentById: jest.fn().mockResolvedValue({ id: 999 }),
      allMinutas: [],
      progressAndCompletedDocumentsByClient: jest.fn(() => []),
      documents: [],
      pagination: { totalPages: 1, currentPage: 1, itemsPerPage: 10, totalItems: 0 },
      lastUpdatedDocumentId: null,
      selectedDocument: null,
    };
    mockFetchDocuments.mockResolvedValue();
  });

  const DOC = { id: 999, title: "Doc Acciones", state: "Published", tags: [] };

  // quality: allow-implementation-coupling (same pattern as the previous batch)
  const dispatch = (wrapper, action, doc = DOC) =>
    wrapper.vm.$.setupState.handleMenuAction(action, doc);

  test.each([
    ["delete", "deleteDocument"],
    ["downloadPDF", "downloadPDFDocument"],
    ["download-pdf", "downloadPDFDocument"],
    ["downloadWord", "downloadWordDocument"],
    ["download-word", "downloadWordDocument"],
    ["downloadSignedDocument", "downloadSignedDocument"],
    ["download-signed", "downloadSignedDocument"],
    ["copy", "copyDocument"],
  ])("%s action dispatches to %s", async (action, fnName) => {
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, action);

    expect(mockActions[fnName]).toHaveBeenCalledWith(DOC);
  });

  test.each([["email"], ["send"]])("%s action opens the email modal", async (action) => {
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, action);

    expect(mockOpenModal).toHaveBeenCalledWith("email", DOC);
  });

  test("addToFolder opens the folder picker for the document", async () => {
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, "addToFolder");

    // quality: allow-implementation-coupling (picker renders behind stubbed Teleport)
    expect(wrapper.vm.$.setupState.showFolderPickerModal).toBe(true);
    expect(wrapper.vm.$.setupState.folderPickerDocument).toEqual(DOC);
  });

  test("unknown actions log a warning instead of crashing", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    await dispatch(wrapper, "inexistente");

    expect(warnSpy).toHaveBeenCalledWith("Unknown action:", "inexistente");
    warnSpy.mockRestore();
  });

  test("handleModalAction closes the actions modal before dispatching", async () => {
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    await wrapper.vm.$.setupState.handleModalAction("preview", DOC);

    expect(wrapper.vm.$.setupState.showActionsModal).toBe(false);
    expect(mockHandlePreviewDocument).toHaveBeenCalledWith(DOC);
  });

  test("relationship count updates land on the matching store document", async () => {
    mockDocumentStore.documents = [{ id: 4, relationships_count: 0 }];
    const wrapper = mountView({ promptDocuments: [DOC] });
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    wrapper.vm.$.setupState.handleUpdateRelationshipCount({ documentId: 4, count: 3 });

    expect(mockDocumentStore.documents[0].relationships_count).toBe(3);
  });

  test("local search filters promptDocuments by title", async () => {
    const wrapper = mountView({
      promptDocuments: [
        { id: 1, title: "Contrato Alfa", state: "Draft", tags: [] },
        { id: 2, title: "Poder Beta", state: "Draft", tags: [] },
      ],
    });
    await flushPromises();

    await wrapper.find("input[placeholder='Buscar...']").setValue("alfa");
    await flushPromises();

    expect(wrapper.text()).toContain("Contrato Alfa");
    expect(wrapper.text()).not.toContain("Poder Beta");
  });

  test("state filter narrows promptDocuments to the chosen state", async () => {
    const wrapper = mountView({
      showStateFilter: true,
      promptDocuments: [
        { id: 1, title: "Borrador Uno", state: "Draft", tags: [] },
        { id: 2, title: "Publicado Dos", state: "Published", tags: [] },
      ],
    });
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    wrapper.vm.$.setupState.filterByState = "Draft";
    await flushPromises();

    expect(wrapper.text()).toContain("Borrador Uno");
    expect(wrapper.text()).not.toContain("Publicado Dos");
  });

  test("parent selected tags filter the visible documents", async () => {
    const wrapper = mountView({
      selectedTags: [{ id: 9 }],
      promptDocuments: [
        { id: 1, title: "Con Tag", state: "Draft", tags: [{ id: 9, name: "T" }] },
        { id: 2, title: "Sin Tag", state: "Draft", tags: [] },
      ],
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Con Tag");
    expect(wrapper.text()).not.toContain("Sin Tag");
  });

  test("client filter (lawyer view) narrows documents by client id", async () => {
    const wrapper = mountView({
      context: "my-documents",
      promptDocuments: [
        { id: 1, title: "De Ana", state: "Draft", tags: [], client: { id: 21, first_name: "Ana", last_name: "G" } },
        { id: 2, title: "De Luis", state: "Draft", tags: [], client: { id: 22, first_name: "Luis", last_name: "P" } },
      ],
    });
    await flushPromises();

    wrapper.vm.$.setupState.filterByClient = 21;
    await flushPromises();

    expect(wrapper.text()).toContain("De Ana");
    expect(wrapper.text()).not.toContain("De Luis");

    // quality: allow-implementation-coupling (selected client name feeds the filter chip)
    expect(wrapper.vm.$.setupState.selectedClientName).toBe("Ana G");
  });

  test("tag search narrows the available tag filter options", async () => {
    const wrapper = mountView({
      promptDocuments: [
        { id: 1, title: "A", state: "Draft", tags: [{ id: 1, name: "Civil" }] },
        { id: 2, title: "B", state: "Draft", tags: [{ id: 2, name: "Laboral" }] },
      ],
    });
    await flushPromises();

    wrapper.vm.$.setupState.tagSearchQuery = "civ";
    await flushPromises();

    // quality: allow-implementation-coupling (filtered options feed the dropdown)
    const names = wrapper.vm.$.setupState.filteredAvailableTags.map((t) => t.name);
    expect(names).toEqual(["Civil"]);

    wrapper.vm.$.setupState.filterByTag = 1;
    await flushPromises();
    expect(wrapper.vm.$.setupState.selectedTagName).toBe("Civil");
  });
});
