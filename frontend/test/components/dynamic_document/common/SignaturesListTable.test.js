import { shallowMount } from "@vue/test-utils";

import SignaturesListTable from "@/components/dynamic_document/common/SignaturesListTable.vue";

const mockRouterPush = jest.fn();
const mockHandlePreviewDocument = jest.fn();
const mockDownloadPDFDocument = jest.fn();
const mockDownloadSignedDocument = jest.fn();
const mockSignDocument = jest.fn();
const mockShowNotification = jest.fn();
const mockCreateRequest = jest.fn();
const mockRegisterUserActivity = jest.fn();
const mockOpenModal = jest.fn();

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

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  create_request: (...args) => mockCreateRequest(...args),
  get_request: jest.fn(),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/stores/dashboard/activity_feed", () => ({
  __esModule: true,
  registerUserActivity: (...args) => mockRegisterUserActivity(...args),
  ACTION_TYPES: { FINISH: "finish" },
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
    },
    openModal: (...args) => mockOpenModal(...args),
    closeModal: jest.fn(),
    getUserRole: () => mockUserStore.currentUser?.role || "client",
  }),
  useDocumentActions: () => ({
    handlePreviewDocument: (...args) => mockHandlePreviewDocument(...args),
    downloadPDFDocument: (...args) => mockDownloadPDFDocument(...args),
    signDocument: (...args) => mockSignDocument(...args),
    downloadSignedDocument: (...args) => mockDownloadSignedDocument(...args),
  }),
  SendDocumentModal: { template: "<div />" },
  DocumentSignaturesModal: { template: "<div />" },
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
  shallowMount(SignaturesListTable, {
    props: {
      state: "PendingSignatures",
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
        DocumentSummaryModal: { template: "<div />" },
        Teleport: true,
      },
    },
  });

describe("SignaturesListTable.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStore = {
      currentUser: { id: 1, role: "lawyer", email: "lawyer@example.com" },
    };
    mockDocumentStore = {
      pendingSignatureDocuments: [],
      fullySignedDocuments: [],
      documents: [],
      init: jest.fn().mockResolvedValue(),
      fetchDocumentsForTab: jest.fn().mockResolvedValue({
        items: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
      }),
    };
    mockCreateRequest.mockResolvedValue({ status: 200 });
    mockShowNotification.mockResolvedValue();
    mockRegisterUserActivity.mockResolvedValue();
  });

  test("filters pending signatures for lawyer", async () => {
    const pendingDocs = [
      { id: 1, title: "Doc 1", created_by: 1, signatures: [] },
      { id: 2, title: "Doc 2", created_by: 2, signatures: [{ signer_email: "lawyer@example.com" }] },
    ];
    mockDocumentStore.fetchDocumentsForTab.mockResolvedValue({
      items: pendingDocs,
      totalItems: 2,
      totalPages: 1,
      currentPage: 1,
    });

    const wrapper = mountView({ state: "PendingSignatures" });

    await flushPromises();

    expect(mockDocumentStore.fetchDocumentsForTab).toHaveBeenCalled();
    // quality: allow-implementation-coupling (Vue component internals needed for this assertion)
    expect(wrapper.vm.$.setupState.tabDocuments).toHaveLength(2);
  });

  test("delegates preview action to document actions", async () => {
    const wrapper = mountView();
    const document = { id: 10, title: "Preview", created_by: 1, signatures: [] };

    // quality: allow-implementation-coupling (Vue component internals needed for this assertion)
    await wrapper.vm.$.setupState.handleMenuAction("preview", document);

    expect(mockHandlePreviewDocument).toHaveBeenCalledWith(document);
  });

  test("confirmRejectDocument emits events and refreshes", async () => {
    const wrapper = mountView();
    const document = { id: 5, title: "Reject", created_by: 1, signatures: [] };

    // quality: allow-implementation-coupling (Vue component internals needed for this assertion)
    wrapper.vm.$.setupState.documentToReject = document;
    wrapper.vm.$.setupState.rejectComment = "Motivo";

    await wrapper.vm.$.setupState.confirmRejectDocument();
    await flushPromises();

    expect(mockCreateRequest).toHaveBeenCalledWith(
      "dynamic-documents/5/reject/1/",
      { comment: "Motivo" }
    );
    expect(wrapper.emitted("document-rejected")[0][0]).toEqual(document);
    expect(mockDocumentStore.fetchDocumentsForTab).toHaveBeenCalled();
  });
});

describe("SignaturesListTable.vue — acciones, estados y paginación (coverage batch)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStore = {
      currentUser: { id: 1, role: "lawyer", email: "lawyer@example.com" },
    };
    mockDocumentStore = {
      pendingSignatureDocuments: [],
      fullySignedDocuments: [],
      documents: [],
      init: jest.fn().mockResolvedValue(),
      fetchDocumentsForTab: jest.fn().mockResolvedValue({
        items: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 1,
      }),
    };
    mockCreateRequest.mockResolvedValue({ status: 200 });
    mockShowNotification.mockResolvedValue();
    mockRegisterUserActivity.mockResolvedValue();
  });

  const DOC = { id: 30, title: "Doc Firmas", signatures: [] };

  // quality: allow-implementation-coupling (setupState pattern shared across this suite)
  const dispatch = (wrapper, action, doc = DOC) =>
    wrapper.vm.$.setupState.handleMenuAction(action, doc);

  test.each([
    ["letterhead", "letterhead"],
    ["relationships", "relationships"],
    ["viewSignatures", "signatures"],
  ])("%s action opens the %s modal", async (action, modal) => {
    const wrapper = mountView();
    await flushPromises();

    await dispatch(wrapper, action);

    expect(mockOpenModal).toHaveBeenCalledWith(modal, DOC);
  });

  test("sign action delegates to signDocument with the modal opener", async () => {
    const wrapper = mountView();
    await flushPromises();

    await dispatch(wrapper, "sign");

    expect(mockSignDocument).toHaveBeenCalledWith(DOC, expect.any(Function));
  });

  test("reject action opens the reject modal with a clean comment", async () => {
    const wrapper = mountView();
    await flushPromises();

    await dispatch(wrapper, "reject");

    // quality: allow-implementation-coupling (modal state behind stubbed Teleport)
    expect(wrapper.vm.$.setupState.documentToReject).toEqual(DOC);
    expect(wrapper.vm.$.setupState.rejectComment).toBe("");
    expect(wrapper.vm.$.setupState.showRejectModal).toBe(true);
  });

  test("viewRejectionReason shows the recorded comment", async () => {
    const wrapper = mountView();
    await flushPromises();
    const doc = {
      ...DOC,
      signatures: [{ rejection_comment: "Falta la firma del representante" }],
    };

    await dispatch(wrapper, "viewRejectionReason", doc);

    // quality: allow-implementation-coupling (modal state behind stubbed Teleport)
    expect(wrapper.vm.$.setupState.rejectionReasonText).toBe(
      "Falta la firma del representante"
    );
    expect(wrapper.vm.$.setupState.showRejectionReasonModal).toBe(true);
  });

  test("viewRejectionReason without a comment informs the user", async () => {
    const wrapper = mountView();
    await flushPromises();

    await dispatch(wrapper, "viewRejectionReason");

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Este documento no tiene un motivo de rechazo registrado.",
      "info"
    );
  });

  test.each([
    ["downloadSignedDocument", mockDownloadSignedDocument],
    ["downloadPDF", mockDownloadPDFDocument],
  ])("%s action triggers its download", async (action, fn) => {
    const wrapper = mountView();
    await flushPromises();

    await dispatch(wrapper, action);

    expect(fn).toHaveBeenCalledWith(DOC);
  });

  test("editAndResend navigates to the correction route with the encoded title", async () => {
    const wrapper = mountView();
    await flushPromises();

    await dispatch(wrapper, "editAndResend", { id: 8, title: "Contrato Río & Mar" });

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/dynamic_document_dashboard/document/use/correction/8/Contrato%20R%C3%ADo%20%26%20Mar"
    );
  });

  test("editAndResend with invalid data warns instead of navigating", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mountView();
    await flushPromises();

    await dispatch(wrapper, "editAndResend", { id: null, title: "" });

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("addToFolder opens the folder picker and unknown actions warn", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mountView();
    await flushPromises();

    await dispatch(wrapper, "addToFolder");
    // quality: allow-implementation-coupling (picker state behind stubbed Teleport)
    expect(wrapper.vm.$.setupState.showFolderPickerModal).toBe(true);

    await dispatch(wrapper, "desconocida");
    expect(warnSpy).toHaveBeenCalledWith("Unknown action:", "desconocida");
    warnSpy.mockRestore();
  });

  test("clicking a document opens the actions modal and modal actions close it", async () => {
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    wrapper.vm.$.setupState.handleDocumentClick(DOC);
    expect(wrapper.vm.$.setupState.showActionsModal).toBe(true);

    await wrapper.vm.$.setupState.handleModalAction("preview", DOC);
    expect(wrapper.vm.$.setupState.showActionsModal).toBe(false);
    expect(mockHandlePreviewDocument).toHaveBeenCalledWith(DOC);
  });

  test("handleSignDocument routes to the named signing view", async () => {
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    wrapper.vm.$.setupState.handleSignDocument({ id: 44 });

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "sign_document",
      params: { id: 44 },
    });
  });

  test("shouldPulsate is true only for the current user's unsigned pending signature", async () => {
    const wrapper = mountView({ state: "PendingSignatures" });
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    const pulsate = wrapper.vm.$.setupState.shouldPulsate;
    expect(pulsate({ signatures: [{ signer_id: 1, signed: false, rejected: false }] })).toBe(true);
    expect(pulsate({ signatures: [{ signer_id: 1, signed: true, rejected: false }] })).toBe(false);
    expect(pulsate({ signatures: [{ signer_id: 9, signed: false, rejected: false }] })).toBe(false);
  });

  test("shouldPulsate never fires outside the pending tab", async () => {
    const wrapper = mountView({ state: "FullySigned" });
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    expect(
      wrapper.vm.$.setupState.shouldPulsate({
        signatures: [{ signer_id: 1, signed: false, rejected: false }],
      })
    ).toBe(false);
  });

  test("isHighlighted compares ids across types", async () => {
    const wrapper = mountView({ highlightDocumentId: "12" });
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    expect(wrapper.vm.$.setupState.isHighlighted({ id: 12 })).toBe(true);
    expect(wrapper.vm.$.setupState.isHighlighted({ id: 13 })).toBe(false);
  });

  test.each([
    ["PendingSignatures", "No tienes documentos pendientes por firmar"],
    ["FullySigned", "No tienes documentos formalizados"],
    ["Archived", "No tienes documentos archivados"],
  ])("empty state for %s shows its message", async (state, message) => {
    const wrapper = mountView({ state });
    await flushPromises();

    expect(wrapper.text()).toContain(message);
  });

  test("fetch options adapt to the tab: FullySigned requires the signer's signature", async () => {
    mountView({ state: "FullySigned" });
    await flushPromises();

    const options = mockDocumentStore.fetchDocumentsForTab.mock.calls.at(-1)[0];
    expect(options.state).toBe("FullySigned");
    expect(options.signerSigned).toBe(true);
  });

  test("fetch options for Archived request rejected and expired documents", async () => {
    mountView({ state: "Archived" });
    await flushPromises();

    const options = mockDocumentStore.fetchDocumentsForTab.mock.calls.at(-1)[0];
    expect(options.states).toEqual(["Rejected", "Expired"]);
    expect(options.state).toBeUndefined();
  });

  test("fetch failures clear the tab and log the error", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockDocumentStore.fetchDocumentsForTab.mockRejectedValue(new Error("api down"));
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    expect(wrapper.vm.$.setupState.tabDocuments).toEqual([]);
    errorSpy.mockRestore();
  });

  test("status text matrix covers formalized, archived and pending variants", async () => {
    const signed = mountView({ state: "FullySigned" });
    await flushPromises();
    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    const signedText = signed.vm.$.setupState.getSignatureStatusText;
    expect(signedText({ signature_type: "informative" })).toBe("Formalizado (Informativo)");
    expect(signedText({ signature_type: "issuer_only" })).toBe("Formalizado (Solo Emisor)");
    expect(signedText({})).toBe("Firmado");

    const archived = mountView({ state: "Archived" });
    await flushPromises();
    const archivedText = archived.vm.$.setupState.getSignatureStatusText;
    expect(archivedText({ state: "Rejected", signature_type: "issuer_only" })).toBe("Rechazado (Solo Emisor)");
    expect(archivedText({ state: "Expired" })).toBe("Expirado");
    expect(archivedText({ state: "Otro" })).toBe("Archivado");

    const pending = mountView({ state: "PendingSignatures" });
    await flushPromises();
    expect(pending.vm.$.setupState.getSignatureStatusText({ signature_type: "informative" })).toBe("Pendiente (Informativo)");
  });

  test("status classes matrix distinguishes tab and document state", async () => {
    const signed = mountView({ state: "FullySigned" });
    await flushPromises();
    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    const signedCls = signed.vm.$.setupState.getSignatureStatusClasses;
    expect(signedCls({ signature_type: "informative" })).toContain("purple");
    expect(signedCls({ signature_type: "issuer_only" })).toContain("blue");
    expect(signedCls({})).toContain("green");

    const archived = mountView({ state: "Archived" });
    await flushPromises();
    const archivedCls = archived.vm.$.setupState.getSignatureStatusClasses;
    expect(archivedCls({ state: "Rejected" })).toContain("red");
    expect(archivedCls({ state: "Expired" })).toContain("gray");

    const pending = mountView({ state: "PendingSignatures" });
    await flushPromises();
    expect(pending.vm.$.setupState.getSignatureStatusClasses({})).toContain("yellow");
  });

  test("pagination helpers respect bounds and jump pages", async () => {
    mockDocumentStore.fetchDocumentsForTab.mockResolvedValue({
      items: [],
      totalItems: 50,
      totalPages: 5,
      currentPage: 1,
    });
    const wrapper = mountView();
    await flushPromises();
    mockDocumentStore.fetchDocumentsForTab.mockClear();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    const state = wrapper.vm.$.setupState;
    state.previousPage();
    expect(mockDocumentStore.fetchDocumentsForTab).not.toHaveBeenCalled();

    state.nextPage();
    await flushPromises();
    expect(mockDocumentStore.fetchDocumentsForTab).toHaveBeenCalledTimes(1);

    state.goToPage(4);
    await flushPromises();
    expect(mockDocumentStore.fetchDocumentsForTab).toHaveBeenCalledTimes(2);

    state.goToPage(99);
    await flushPromises();
    expect(mockDocumentStore.fetchDocumentsForTab).toHaveBeenCalledTimes(2);
  });

  test("clearFilters resets every filter control", async () => {
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    const state = wrapper.vm.$.setupState;
    state.filterByTag = 3;
    state.dateFrom = "2026-01-01";
    state.dateTo = "2026-02-01";
    state.clearFilters();

    expect(state.filterByTag).toBeNull();
    expect(state.dateFrom).toBe("");
    expect(state.dateTo).toBe("");
  });

  test("formatDate keeps the date part and empties null values", async () => {
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    const formatDate = wrapper.vm.$.setupState.formatDate;
    expect(formatDate(null)).toBe("");
    expect(formatDate("2026-05-10T00:00:00Z")).toBe("2026-05-10");
  });
});

describe("SignaturesListTable.vue — selección, export y rechazo (coverage batch 2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStore = {
      currentUser: { id: 1, role: "lawyer", email: "lawyer@example.com" },
    };
    mockDocumentStore = {
      pendingSignatureDocuments: [],
      fullySignedDocuments: [],
      documents: [],
      init: jest.fn().mockResolvedValue(),
      fetchDocumentsForTab: jest.fn().mockResolvedValue({
        items: [
          { id: 1, title: "Alfa", signatures: [], tags: [{ id: 1, name: "Civil" }] },
          { id: 2, title: "Beta", signatures: [], tags: [] },
        ],
        totalItems: 2,
        totalPages: 1,
        currentPage: 1,
      }),
    };
    mockCreateRequest.mockResolvedValue({ status: 200 });
    mockShowNotification.mockResolvedValue();
    mockRegisterUserActivity.mockResolvedValue();
  });

  test("selection toggles cover all, one, select and deselect", async () => {
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    const state = wrapper.vm.$.setupState;
    state.toggleSelectAll();
    expect(state.selectedDocuments).toEqual([1, 2]);
    expect(state.allSelected).toBe(true);

    state.toggleSelectAll();
    expect(state.selectedDocuments).toEqual([]);

    state.toggleDocumentSelection(2);
    expect(state.selectedDocuments).toEqual([2]);
    state.toggleDocumentSelection(2);
    expect(state.selectedDocuments).toEqual([]);

    state.selectAll();
    expect(state.selectedDocuments).toEqual([1, 2]);
    state.deselectAll();
    expect(state.selectedDocuments).toEqual([]);
  });

  test("availableTags dedupes and the tag filter exposes its name", async () => {
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    const state = wrapper.vm.$.setupState;
    expect(state.availableTags.map((t) => t.name)).toEqual(["Civil"]);

    state.tagSearchQuery = "civ";
    expect(state.filteredAvailableTags.map((t) => t.name)).toEqual(["Civil"]);

    state.filterByTag = 1;
    expect(state.selectedTagName).toBe("Civil");
  });

  test("exportDocuments downloads a CSV with the visible rows", async () => {
    const wrapper = mountView();
    await flushPromises();
    window.URL.createObjectURL = jest.fn(() => "blob:csv");
    window.URL.revokeObjectURL = jest.fn();
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    wrapper.vm.$.setupState.exportDocuments();

    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  test("confirmRejectDocument surfaces API rejections as errors", async () => {
    mockCreateRequest.mockResolvedValue({ status: 400 });
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    wrapper.vm.$.setupState.documentToReject = { id: 5, title: "R" };
    await wrapper.vm.$.setupState.confirmRejectDocument();
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al rechazar el documento.",
      "error"
    );
  });

  test("confirmRejectDocument catches network failures", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCreateRequest.mockRejectedValue(new Error("offline"));
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    wrapper.vm.$.setupState.documentToReject = { id: 5, title: "R" };
    await wrapper.vm.$.setupState.confirmRejectDocument();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al rechazar el documento.",
      "error"
    );
    errorSpy.mockRestore();
  });

  test("confirmRejectDocument without a target is a no-op", async () => {
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    await wrapper.vm.$.setupState.confirmRejectDocument();

    expect(mockCreateRequest).not.toHaveBeenCalled();
  });

  test("summary helpers prefer the variable value and detect content", async () => {
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    const state = wrapper.vm.$.setupState;
    const doc = {
      summary_counterparty: "Fallback SA",
      variables: [{ summary_field: "counterparty", value: "Real SA" }],
    };
    expect(state.getSummaryCounterparty(doc)).toBe("Real SA");
    expect(state.getSummaryCounterparty({})).toBeNull();
    expect(state.hasSummary(doc)).toBe(true);
    expect(state.hasSummary({})).toBe(false);

    state.openSummaryModal(doc);
    expect(state.showSummaryModal).toBe(true);
  });

  test("handleRefresh refetches and notifies the parent", async () => {
    const wrapper = mountView();
    await flushPromises();
    mockDocumentStore.fetchDocumentsForTab.mockClear();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    await wrapper.vm.$.setupState.handleRefresh();

    expect(mockDocumentStore.fetchDocumentsForTab).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("refresh")).toBeTruthy();
  });

  test("visiblePages windows long paginations with ellipsis", async () => {
    mockDocumentStore.fetchDocumentsForTab.mockResolvedValue({
      items: [],
      totalItems: 100,
      totalPages: 10,
      currentPage: 1,
    });
    const wrapper = mountView();
    await flushPromises();

    // quality: allow-implementation-coupling (setupState pattern shared across this suite)
    const state = wrapper.vm.$.setupState;
    expect(state.visiblePages).toContain("...");
    expect(state.visiblePages[0]).toBe(1);
    expect(state.visiblePages.at(-1)).toBe(10);
  });
});
