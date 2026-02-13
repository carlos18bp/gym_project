import { shallowMount } from "@vue/test-utils";
import { ref } from "vue";

import DocumentRelationshipsModal from "@/components/dynamic_document/modals/DocumentRelationshipsModal.vue";

const mockLoadAvailableDocuments = jest.fn();
const mockLoadRelatedDocuments = jest.fn();
const mockLoadRelationships = jest.fn();
const mockCreateRelationship = jest.fn();
const mockDeleteRelationship = jest.fn();
const mockShowNotification = jest.fn();

let mockAvailableDocuments;
let mockRelatedDocuments;
let mockRelationships;
let mockIsLoading;
let mockIsLoadingAvailable;
let mockIsLoadingRelated;

jest.mock("@/composables/useDocumentRelationships", () => ({
  __esModule: true,
  useDocumentRelationships: () => ({
    availableDocuments: mockAvailableDocuments,
    relatedDocuments: mockRelatedDocuments,
    relationships: mockRelationships,
    isLoading: mockIsLoading,
    isLoadingAvailable: mockIsLoadingAvailable,
    isLoadingRelated: mockIsLoadingRelated,
    loadAvailableDocuments: (...args) => mockLoadAvailableDocuments(...args),
    loadRelatedDocuments: (...args) => mockLoadRelatedDocuments(...args),
    loadRelationships: (...args) => mockLoadRelationships(...args),
    createRelationship: (...args) => mockCreateRelationship(...args),
    deleteRelationship: (...args) => mockDeleteRelationship(...args),
  }),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  DocumentIcon: { template: "<span />" },
  XMarkIcon: { template: "<span />" },
  LinkIcon: { template: "<span />" },
  DocumentDuplicateIcon: { template: "<span />" },
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const mountView = (props = {}) =>
  shallowMount(DocumentRelationshipsModal, {
    props: {
      isOpen: false,
      document: { id: 1, title: "Doc", state: "Completed" },
      ...props,
    },
    global: {
      stubs: {
        RelateDocumentsTab: { template: "<div />" },
        RelatedDocumentsTab: { template: "<div />" },
      },
    },
  });

describe("DocumentRelationshipsModal.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailableDocuments = ref([]);
    mockRelatedDocuments = ref([]);
    mockRelationships = ref([]);
    mockIsLoading = ref(false);
    mockIsLoadingAvailable = ref(false);
    mockIsLoadingRelated = ref(false);
    mockLoadAvailableDocuments.mockResolvedValue();
    mockLoadRelatedDocuments.mockResolvedValue();
    mockLoadRelationships.mockResolvedValue();
    mockCreateRelationship.mockResolvedValue();
    mockDeleteRelationship.mockResolvedValue();
    mockShowNotification.mockResolvedValue();
  });

  test("loads data on open and defaults to relate tab", async () => {
    const wrapper = mountView({ isOpen: true });

    await flushPromises();

    expect(mockLoadAvailableDocuments).toHaveBeenCalledWith({
      filterCompleted: true,
    });
    expect(mockLoadRelatedDocuments).toHaveBeenCalled();
    expect(mockLoadRelationships).toHaveBeenCalled();
    expect(wrapper.vm.$.setupState.activeTab).toBe("relate");
  });

  test("defer save relate/unrelate updates pending list", async () => {
    const wrapper = mountView({
      isOpen: true,
      deferSave: true,
      pendingRelationships: [1],
    });

    await wrapper.vm.$.setupState.handleRelateDocument({ id: 2 });

    expect(wrapper.emitted("update-pending")[0][0]).toEqual([1, 2]);
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Documento agregado a relaciones pendientes",
      "success"
    );

    await wrapper.vm.$.setupState.handleUnrelateDocument(2);

    expect(wrapper.emitted("update-pending")[1][0]).toEqual([1]);
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Documento removido de relaciones pendientes",
      "success"
    );
  });

  test("closeModal emits update-count, refresh, and close", async () => {
    mockRelationships.value = [{ id: 1 }, { id: 2 }];
    const wrapper = mountView({ isOpen: true });

    await wrapper.vm.$.setupState.closeModal();

    expect(wrapper.emitted("update-count")[0][0]).toEqual({
      documentId: 1,
      count: 2,
    });
    expect(wrapper.emitted("refresh")).toBeTruthy();
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("warns when document is not completed", async () => {
    const wrapper = mountView({
      document: { id: 1, title: "Doc", state: "Progress" },
    });

    await wrapper.vm.$.setupState.handleRelateDocument({ id: 9 });

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Solo puedes crear asociaciones para documentos completados.",
      "warning"
    );
    expect(mockCreateRelationship).not.toHaveBeenCalled();
  });
});
