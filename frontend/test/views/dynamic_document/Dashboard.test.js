import { shallowMount } from "@vue/test-utils";
import { ref as mockRef } from "vue";

import DynamicDocumentDashboard from "@/views/dynamic_document/Dashboard.vue";

const mockRouterPush = jest.fn();
const mockHandleFeatureAccess = jest.fn((_, callback) => callback && callback());
const mockShowNotification = jest.fn();

let mockRoute;
let mockUserStore;
let mockDocumentStore;
let mockFolderStore;
let mockIsBasicUser = mockRef(false);

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: (...args) => mockRouterPush(...args),
  }),
  useRoute: () => mockRoute,
}));

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => mockUserStore,
}));

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => mockDocumentStore,
}));

jest.mock("@/stores/dynamic_document/folders", () => ({
  __esModule: true,
  useDocumentFolderStore: () => mockFolderStore,
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/shared/document_utils", () => ({
  __esModule: true,
  showPreviewModal: mockRef(false),
  previewDocumentData: mockRef({}),
}));

jest.mock("@/composables/useBasicUserRestrictions", () => ({
  __esModule: true,
  useBasicUserRestrictions: () => ({
    isBasicUser: mockIsBasicUser,
    handleFeatureAccess: (...args) => mockHandleFeatureAccess(...args),
  }),
}));

jest.mock("@headlessui/vue", () => ({
  __esModule: true,
  Menu: { template: "<div><slot /></div>" },
  MenuButton: { template: "<button><slot /></button>" },
  MenuItems: { template: "<div><slot /></div>" },
  MenuItem: { template: "<div><slot /></div>" },
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  FingerPrintIcon: { template: "<span />" },
  XMarkIcon: { template: "<span />" },
  DocumentTextIcon: { template: "<span />" },
  PlusIcon: { template: "<span />" },
  MagnifyingGlassIcon: { template: "<span />" },
  ChevronDownIcon: { template: "<span />" },
}));

const flushPromises = async () => {
  await Promise.resolve();
};

const buildDocumentStore = (overrides = {}) => ({
  draftAndPublishedDocumentsUnassigned: [],
  progressAndCompletedDocumentsByClient: jest.fn(() => []),
  filteredDocumentsBySearchAndTags: jest.fn(() => []),
  init: jest.fn().mockResolvedValue(),
  fetchDocumentById: jest.fn().mockResolvedValue(),
  documents: [],
  isLoading: false,
  lastUpdatedDocumentId: null,
  selectedDocument: null,
  ...overrides,
});

const buildUserStore = (overrides = {}) => ({
  currentUser: null,
  init: jest.fn().mockResolvedValue(),
  ...overrides,
});

const buildFolderStore = (overrides = {}) => ({
  init: jest.fn().mockResolvedValue(),
  fetchFolders: jest.fn().mockResolvedValue(),
  ...overrides,
});

const mountView = () =>
  shallowMount(DynamicDocumentDashboard, {
    global: {
      stubs: {
        ModalTransition: { template: "<div><slot /></div>" },
        FolderManagement: { template: "<div />" },
        DocumentListTable: { template: "<div />" },
        UseDocumentTable: { template: "<div />" },
        SignaturesListTable: { template: "<div />" },
        DocumentFinishedByClientListTable: { template: "<div />" },
        DocumentInProgressByClientListTable: { template: "<div />" },
        CreateDocumentByLawyer: { template: "<div />" },
        ElectronicSignature: { template: "<div />" },
        DocumentPreviewModal: { template: "<div />" },
        GlobalLetterheadModal: { template: "<div />" },
        LetterheadModal: { template: "<div />" },
        DocumentRelationshipsModal: { template: "<div />" },
      },
    },
  });

describe("DynamicDocument Dashboard.vue", () => {
  beforeEach(() => {
    mockRoute = { path: "/dynamic_document_dashboard", query: {} };
    mockRouterPush.mockReset();
    mockHandleFeatureAccess.mockReset();
    mockShowNotification.mockReset();
    mockIsBasicUser.value = false;
    mockUserStore = buildUserStore();
    mockDocumentStore = buildDocumentStore();
    mockFolderStore = buildFolderStore();
    localStorage.clear();
  });

  test("redirects to login when currentUser is missing", async () => {
    const wrapper = mountView();

    await flushPromises();

    expect(mockRouterPush).toHaveBeenCalledWith("/login");
    expect(wrapper.exists()).toBe(true);
  });

  test("initializes stores and honors lawyer tab query; handles create minuta", async () => {
    mockUserStore.currentUser = { id: 1, role: "lawyer", has_signature: true };
    mockRoute.query = { lawyerTab: "archived-documents" };
    mockDocumentStore = buildDocumentStore({
      documents: [{ id: 10 }],
      selectedDocument: { id: 99 },
    });
    localStorage.setItem("lastUpdatedDocumentId", "10");

    const wrapper = mountView();
    await flushPromises();

    expect(mockUserStore.init).toHaveBeenCalled();
    expect(mockFolderStore.init).toHaveBeenCalled();
    expect(wrapper.vm.$.setupState.activeLawyerTab).toBe("archived-documents");
    expect(mockDocumentStore.selectedDocument).toBe(null);
    expect(mockDocumentStore.lastUpdatedDocumentId).toBe(10);

    wrapper.vm.$.setupState.handleCreateMinuta();

    expect(wrapper.vm.$.setupState.showCreateDocumentModal).toBe(true);
    expect(mockDocumentStore.selectedDocument).toBe(null);
  });

  test("loads useDocument section for clients and resets active tab", async () => {
    mockUserStore.currentUser = { id: 2, role: "client" };
    mockRoute.query = { tab: "signed-documents" };

    const wrapper = mountView();

    await flushPromises();

    expect(wrapper.vm.$.setupState.activeTab).toBe("signed-documents");

    await wrapper.vm.$.setupState.handleSection("useDocument");

    // documentStore.init is no longer called — UseDocumentTable loads its own data via fetchTabData
    expect(wrapper.vm.$.setupState.currentSection).toBe("useDocument");
    expect(wrapper.vm.$.setupState.activeTab).toBe(null);
    expect(wrapper.vm.$.setupState.isNavigatingToUseDocument).toBe(false);
  });
});
