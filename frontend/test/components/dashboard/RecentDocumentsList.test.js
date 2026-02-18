import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import { useUserStore } from "@/stores/auth/user";
import { useAuthStore } from "@/stores/auth/auth";
import { useRecentDocumentStore } from "@/stores/dashboard/recentDocument";

import RecentDocumentsList from "@/components/dashboard/RecentDocumentsList.vue";

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  CheckCircleIcon: { name: "CheckCircleIcon" },
  PencilIcon: { name: "PencilIcon" },
  ClockIcon: { name: "ClockIcon" },
  DocumentCheckIcon: { name: "DocumentCheckIcon" },
  ExclamationTriangleIcon: { name: "ExclamationTriangleIcon" },
}));

const mockRouterPush = jest.fn();

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

const mockRegisterView = jest.fn();

jest.mock("@/composables/useRecentViews", () => ({
  __esModule: true,
  useRecentViews: () => ({
    registerView: mockRegisterView,
  }),
}));

const mockOpenPreviewModal = jest.fn();

jest.mock("@/shared/document_utils", () => ({
  __esModule: true,
  showPreviewModal: { value: false },
  previewDocumentData: { value: { title: "", content: "" } },
  openPreviewModal: (...args) => mockOpenPreviewModal(...args),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: jest.fn(),
}));

jest.mock("@/shared/confirmation_alert", () => ({
  __esModule: true,
  showConfirmationAlert: jest.fn(),
}));

const flushPromises = async () => {
  await Promise.resolve();
};

describe("RecentDocumentsList.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("shows loading state when currentUser is not set", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const authStore = useAuthStore();
    const userStore = useUserStore();
    const recentDocumentStore = useRecentDocumentStore();

    authStore.$patch({ userAuth: null });
    userStore.$patch({ currentUser: null });

    jest.spyOn(userStore, "setCurrentUser").mockImplementation(() => null);
    jest.spyOn(recentDocumentStore, "fetchRecentDocuments").mockResolvedValue();

    const wrapper = mount(RecentDocumentsList, {
      global: {
        plugins: [pinia],
        stubs: {
          ModalTransition: { template: "<div><slot /></div>" },
          SendDocument: { template: "<div />" },
          DocumentPreviewModal: { template: "<div />" },
          CreateDocumentByLawyer: { template: "<div />" },
          UseDocumentByClient: { template: "<div />" },
          DocumentCard: { template: "<div />" },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Cargando documentos...");
  });

  test("shows empty state when currentUser is set but there are no recent documents", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const recentDocumentStore = useRecentDocumentStore();

    userStore.$patch({ currentUser: { id: 1, role: "client" } });
    recentDocumentStore.$patch({ recentDocuments: [] });

    jest.spyOn(recentDocumentStore, "fetchRecentDocuments").mockResolvedValue();

    const wrapper = mount(RecentDocumentsList, {
      global: {
        plugins: [pinia],
        stubs: {
          ModalTransition: { template: "<div><slot /></div>" },
          SendDocument: { template: "<div />" },
          DocumentPreviewModal: { template: "<div />" },
          CreateDocumentByLawyer: { template: "<div />" },
          UseDocumentByClient: { template: "<div />" },
          DocumentCard: { template: "<div />" },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("No hay documentos recientes");
  });

  test("renders document cards and handles click and refresh events", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const recentDocumentStore = useRecentDocumentStore();

    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    recentDocumentStore.$patch({
      recentDocuments: [
        {
          document: {
            id: 10,
            title: "Doc",
            state: "Draft",
            content: "",
            variables: [],
          },
        },
      ],
    });

    const fetchSpy = jest.spyOn(recentDocumentStore, "fetchRecentDocuments").mockResolvedValue();

    const wrapper = mount(RecentDocumentsList, {
      global: {
        plugins: [pinia],
        stubs: {
          ModalTransition: { template: "<div><slot /></div>" },
          SendDocument: { template: "<div />" },
          DocumentPreviewModal: { template: "<div />" },
          CreateDocumentByLawyer: { template: "<div />" },
          UseDocumentByClient: { template: "<div />" },
          DocumentCard: {
            props: ["document"],
            template:
              "<button data-test='doc-card' @click=\"$emit('click', document)\" @dblclick=\"$emit('refresh')\">card</button>",
          },
        },
      },
    });

    await flushPromises();

    await wrapper.find("[data-test='doc-card']").trigger("click");

    expect(mockRegisterView).toHaveBeenCalledWith("document", 10);

    await wrapper.find("[data-test='doc-card']").trigger("dblclick");

    expect(fetchSpy).toHaveBeenCalled();
  });

  test("maps document states to correct status icon/text/badge classes and cardType (lawyer role)", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const recentDocumentStore = useRecentDocumentStore();

    userStore.$patch({ currentUser: { id: 1, role: "lawyer" } });

    recentDocumentStore.$patch({
      recentDocuments: [
        { document: { id: 1, title: "A", state: "Completed" } },
        { document: { id: 2, title: "B", state: "FullySigned" } },
        { document: { id: 3, title: "C", state: "Published" } },
        { document: { id: 4, title: "D", state: "PendingSignatures" } },
        { document: { id: 5, title: "E", state: "Progress" } },
        { document: { id: 6, title: "F", state: "Draft" } },
        { document: { id: 7, title: "G", state: "Weird" } },
      ],
    });

    const fetchSpy = jest.spyOn(recentDocumentStore, "fetchRecentDocuments").mockResolvedValue();

    const received = [];

    const wrapper = mount(RecentDocumentsList, {
      global: {
        plugins: [pinia],
        stubs: {
          ModalTransition: { template: "<div><slot /></div>" },
          SendDocument: { template: "<div />" },
          DocumentPreviewModal: { template: "<div />" },
          CreateDocumentByLawyer: { template: "<div data-test='lawyer-modal' />" },
          UseDocumentByClient: { template: "<div data-test='client-modal' />" },
          DocumentCard: {
            props: [
              "document",
              "cardType",
              "statusIcon",
              "statusText",
              "statusBadgeClasses",
              "showClientName",
            ],
            mounted() {
              received.push({
                id: this.document?.id,
                cardType: this.cardType,
                statusIconName: this.statusIcon?.name,
                statusText: this.statusText,
                statusBadgeClasses: this.statusBadgeClasses,
                showClientName: this.showClientName,
              });
            },
            template: "<button data-test='doc-card' @click=\"$emit('click', document)\">card</button>",
          },
        },
      },
    });

    await flushPromises();

    expect(fetchSpy).toHaveBeenCalled();

    const byId = Object.fromEntries(received.map((r) => [r.id, r]));

    expect(byId).toMatchObject({
      1: {
        cardType: "lawyer",
        statusIconName: "CheckCircleIcon",
        statusText: "Completado",
        showClientName: true,
        statusBadgeClasses: expect.stringContaining("bg-green-100"),
      },
      2: {
        cardType: "lawyer",
        statusIconName: "CheckCircleIcon",
        statusText: "Firmado",
        showClientName: true,
        statusBadgeClasses: expect.stringContaining("bg-green-100"),
      },
      3: {
        cardType: "lawyer",
        statusIconName: "DocumentCheckIcon",
        statusText: "Publicado",
        showClientName: true,
        statusBadgeClasses: expect.stringContaining("bg-blue-100"),
      },
      4: {
        cardType: "lawyer",
        statusIconName: "ClockIcon",
        statusText: "Pendiente",
        showClientName: true,
        statusBadgeClasses: expect.stringContaining("bg-yellow-100"),
      },
      5: {
        cardType: "lawyer",
        statusIconName: "PencilIcon",
        statusText: "En Progreso",
        showClientName: true,
        statusBadgeClasses: expect.stringContaining("bg-gray-100"),
      },
      6: {
        cardType: "lawyer",
        statusIconName: "PencilIcon",
        statusText: "Borrador",
        showClientName: true,
        statusBadgeClasses: expect.stringContaining("bg-gray-100"),
      },
      7: {
        cardType: "lawyer",
        statusIconName: "ExclamationTriangleIcon",
        statusText: "Weird",
        showClientName: true,
        statusBadgeClasses: expect.stringContaining("text-gray-600"),
      },
    });

    await wrapper.findAll("[data-test='doc-card']")[0].trigger("click");
    expect(mockRegisterView).toHaveBeenCalledWith("document", 1);
  });

  test("close handlers reset modal state and refreshes recent documents when updatedDocId provided", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const recentDocumentStore = useRecentDocumentStore();

    userStore.$patch({ currentUser: { id: 1, role: "client" } });
    recentDocumentStore.$patch({ recentDocuments: [] });

    const fetchSpy = jest.spyOn(recentDocumentStore, "fetchRecentDocuments").mockResolvedValue();

    const wrapper = mount(RecentDocumentsList, {
      global: {
        plugins: [pinia],
        stubs: {
          ModalTransition: { template: "<div><slot /></div>" },
          DocumentPreviewModal: { template: "<div />" },
          DocumentCard: { template: "<div />" },
          CreateDocumentByLawyer: {
            template: "<div data-test='lawyer-modal'><button data-test='emit-close-lawyer' @click=\"$emit('close', {})\">x</button></div>",
          },
          UseDocumentByClient: {
            template: "<div data-test='client-modal'><button data-test='emit-close-client' @click=\"$emit('close', { updatedDocId: 55 })\">x</button></div>",
          },
          SendDocument: {
            props: ["emailDocument"],
            template: "<button data-test='close-email' @click=\"$emit('closeEmailModal')\">close</button>",
          },
        },
      },
    });

    await flushPromises();

    wrapper.vm.showEditDocumentModal = true;
    wrapper.vm.selectedDocumentId = 123;
    wrapper.vm.showSendDocumentViaEmailModal = true;
    wrapper.vm.emailDocument = { id: 9 };
    await wrapper.vm.$nextTick();

    expect(wrapper.find("[data-test='client-modal']").exists()).toBe(true);
    expect(wrapper.find("[data-test='lawyer-modal']").exists()).toBe(false);

    await wrapper.find("[data-test='emit-close-client']").trigger("click");
    await flushPromises();

    expect(fetchSpy).toHaveBeenCalled();
    expect(wrapper.vm.showEditDocumentModal).toBe(false);
    expect(wrapper.vm.selectedDocumentId).toBe(null);

    await wrapper.find("[data-test='close-email']").trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.showSendDocumentViaEmailModal).toBe(false);
    expect(wrapper.vm.emailDocument).toEqual({});
  });
});
