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
    openModal: jest.fn(),
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
    };
    mockCreateRequest.mockResolvedValue({ status: 200 });
    mockShowNotification.mockResolvedValue();
    mockRegisterUserActivity.mockResolvedValue();
  });

  test("filters pending signatures for lawyer", async () => {
    mockDocumentStore.pendingSignatureDocuments = [
      { id: 1, title: "Doc 1", created_by: 1, signatures: [] },
      { id: 2, title: "Doc 2", created_by: 2, signatures: [{ signer_email: "lawyer@example.com" }] },
      { id: 3, title: "Doc 3", created_by: 2, signatures: [{ signer_email: "other@example.com" }] },
    ];

    const wrapper = mountView({ state: "PendingSignatures" });

    await flushPromises();

    expect(wrapper.vm.$.setupState.filteredDocuments).toHaveLength(2);
  });

  test("delegates preview action to document actions", async () => {
    const wrapper = mountView();
    const document = { id: 10, title: "Preview", created_by: 1, signatures: [] };

    await wrapper.vm.$.setupState.handleMenuAction("preview", document);

    expect(mockHandlePreviewDocument).toHaveBeenCalledWith(document);
  });

  test("confirmRejectDocument emits events and refreshes", async () => {
    const wrapper = mountView();
    const document = { id: 5, title: "Reject", created_by: 1, signatures: [] };

    wrapper.vm.$.setupState.documentToReject = document;
    wrapper.vm.$.setupState.rejectComment = "Motivo";

    await wrapper.vm.$.setupState.confirmRejectDocument();
    await flushPromises();

    expect(mockCreateRequest).toHaveBeenCalledWith(
      "dynamic-documents/5/reject/1/",
      { comment: "Motivo" }
    );
    expect(wrapper.emitted("document-rejected")[0][0]).toEqual(document);
    expect(mockDocumentStore.init).toHaveBeenCalledWith(true);
  });
});
