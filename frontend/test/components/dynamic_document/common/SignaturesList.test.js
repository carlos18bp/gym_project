import { mount } from "@vue/test-utils";
import { reactive, nextTick } from "vue";

let mockUserStore;
jest.mock("@/stores/auth/user", () => ({
  useUserStore: () => mockUserStore,
}));

let mockDocumentStore;
jest.mock("@/stores/dynamic_document", () => ({
  useDynamicDocumentStore: () => mockDocumentStore,
}));

const mockGetRequest = jest.fn();
jest.mock("@/stores/services/request_http", () => ({
  get_request: (...args) => mockGetRequest(...args),
}));

const mockShowNotification = jest.fn().mockResolvedValue(undefined);
jest.mock("@/shared/notification_message", () => ({
  showNotification: (...args) => mockShowNotification(...args),
}));

import SignaturesList from "@/components/dynamic_document/common/SignaturesList.vue";

const CardStub = {
  name: "SignatureDocumentCard",
  props: ["document", "highlightedDocId"],
  template: "<div data-testid='sig-card'>{{ document.title }}</div>",
};

const stubs = {
  SignatureDocumentCard: CardStub,
  DocumentPreviewModal: { name: "DocumentPreviewModal", template: "<div />" },
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const lawyerDocs = [
  { id: 1, title: "Contrato A", created_by: 10, state: "PendingSignatures", tags: [] },
  { id: 2, title: "Contrato B", created_by: 99, state: "PendingSignatures", tags: [] },
];

const mountList = async (props = {}) => {
  const wrapper = mount(SignaturesList, {
    props: { state: "PendingSignatures", ...props },
    global: { stubs },
  });
  await flushPromises();
  return wrapper;
};

describe("components/dynamic_document/common/SignaturesList.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockUserStore = reactive({
      currentUser: { id: 10, role: "lawyer", email: "abogado@gm.co" },
    });
    mockDocumentStore = reactive({
      documents: [],
      pendingSignatureDocuments: [...lawyerDocs],
      fullySignedDocuments: [],
      lastUpdatedDocumentId: null,
      init: jest.fn().mockResolvedValue(undefined),
      $patch: jest.fn(function (fn) {
        fn(mockDocumentStore);
      }),
    });
  });

  test("lawyer sees only pending documents they created", async () => {
    const wrapper = await mountList();

    const cards = wrapper.findAll("[data-testid='sig-card']");
    expect(cards).toHaveLength(1);
    expect(cards[0].text()).toBe("Contrato A");
  });

  test("lawyer sees only fully signed documents they created", async () => {
    mockDocumentStore.pendingSignatureDocuments = [];
    mockDocumentStore.fullySignedDocuments = [
      { id: 3, title: "Firmado Propio", created_by: 10, state: "FullySigned", tags: [] },
      { id: 4, title: "Firmado Ajeno", created_by: 99, state: "FullySigned", tags: [] },
    ];
    const wrapper = await mountList({ state: "FullySigned" });

    const cards = wrapper.findAll("[data-testid='sig-card']");
    expect(cards).toHaveLength(1);
    expect(cards[0].text()).toBe("Firmado Propio");
  });

  test("client sees pending documents where they are a signer", async () => {
    mockUserStore.currentUser = { id: 20, role: "client", email: "cli@gm.co" };
    mockDocumentStore.documents = [
      {
        id: 5,
        title: "Para Firmar",
        state: "PendingSignatures",
        signatures: [{ signer_email: "cli@gm.co", signed: false }],
        tags: [],
      },
      {
        id: 6,
        title: "De Otro",
        state: "PendingSignatures",
        signatures: [{ signer_email: "otro@gm.co", signed: false }],
        tags: [],
      },
      { id: 7, title: "Borrador", state: "Draft", signatures: [], tags: [] },
    ];
    const wrapper = await mountList();

    const titles = wrapper.findAll("[data-testid='sig-card']").map((c) => c.text());
    expect(titles).toEqual(["Para Firmar"]);
  });

  test("client sees signed documents only when their signature is completed", async () => {
    mockUserStore.currentUser = { id: 20, role: "client", email: "cli@gm.co" };
    mockDocumentStore.documents = [
      {
        id: 8,
        title: "Firmado",
        state: "FullySigned",
        signatures: [{ signer_email: "cli@gm.co", signed: true }],
        tags: [],
      },
      {
        id: 9,
        title: "Sin Firmar",
        state: "FullySigned",
        signatures: [{ signer_email: "cli@gm.co", signed: false }],
        tags: [],
      },
    ];
    const wrapper = await mountList({ state: "FullySigned" });

    const titles = wrapper.findAll("[data-testid='sig-card']").map((c) => c.text());
    expect(titles).toEqual(["Firmado"]);
  });

  test("filters documents by search query", async () => {
    const wrapper = await mountList({ searchQuery: "contrato a" });

    const titles = wrapper.findAll("[data-testid='sig-card']").map((c) => c.text());
    expect(titles).toEqual(["Contrato A"]);
  });

  test("filters documents by selected tags", async () => {
    mockDocumentStore.pendingSignatureDocuments = [
      { id: 1, title: "Etiquetado", created_by: 10, state: "PendingSignatures", tags: [{ id: 7 }] },
      { id: 2, title: "Sin Tags", created_by: 10, state: "PendingSignatures", tags: [] },
    ];
    const wrapper = await mountList({ selectedTags: [{ id: 7 }] });

    const titles = wrapper.findAll("[data-testid='sig-card']").map((c) => c.text());
    expect(titles).toEqual(["Etiquetado"]);
  });

  test("shows the pending empty state when nothing matches", async () => {
    mockDocumentStore.pendingSignatureDocuments = [];
    const wrapper = await mountList();

    expect(wrapper.text()).toContain("No tienes documentos pendientes por firmar");
    expect(wrapper.text()).toContain("Firmas pendientes");
  });

  test("shows the signed empty state for the FullySigned tab", async () => {
    const wrapper = await mountList({ state: "FullySigned" });

    expect(wrapper.text()).toContain("No tienes documentos firmados");
    expect(wrapper.text()).toContain("Documentos firmados");
  });

  test("initializes the document store on mount", async () => {
    await mountList();

    expect(mockDocumentStore.init).toHaveBeenCalledWith(true);
  });

  test("falls back to the lawyer endpoint when the store is empty", async () => {
    mockDocumentStore.pendingSignatureDocuments = [];
    mockGetRequest.mockResolvedValue({ data: [{ id: 11, title: "Remoto" }] });

    await mountList();

    expect(mockGetRequest).toHaveBeenCalledWith(
      "dynamic-documents/created-by/10/pending-signatures/"
    );
    expect(mockDocumentStore.documents.map((d) => d.id)).toContain(11);
  });

  test("falls back to the client endpoint for non-lawyers", async () => {
    mockUserStore.currentUser = { id: 20, role: "client", email: "cli@gm.co" };
    mockGetRequest.mockResolvedValue({ data: [] });
    mockDocumentStore.pendingSignatureDocuments = [];

    await mountList();

    expect(mockGetRequest).toHaveBeenCalledWith(
      "dynamic-documents/user/20/pending-documents-full/"
    );
  });

  test("notifies an error when the refresh fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockDocumentStore.init.mockRejectedValue(new Error("api down"));

    await mountList();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al actualizar documentos",
      "error"
    );
    errorSpy.mockRestore();
  });

  test("highlights the store's last updated document when listed", async () => {
    mockDocumentStore.lastUpdatedDocumentId = "1";
    const wrapper = await mountList();

    const card = wrapper.findComponent(CardStub);
    expect(card.props("highlightedDocId")).toBe("1");
  });

  test("falls back to localStorage for the highlighted document", async () => {
    localStorage.setItem("lastUpdatedDocumentId", "1");
    const wrapper = await mountList();

    expect(wrapper.findComponent(CardStub).props("highlightedDocId")).toBe("1");
    localStorage.removeItem("lastUpdatedDocumentId");
  });

  test("re-fetches when the current user changes", async () => {
    await mountList();
    expect(mockDocumentStore.init).toHaveBeenCalledTimes(1);

    mockUserStore.currentUser = { id: 33, role: "lawyer", email: "otro@gm.co" };
    await nextTick();
    await flushPromises();

    expect(mockDocumentStore.init).toHaveBeenCalledTimes(2);
  });

  test("re-fetches when the search query is cleared", async () => {
    const wrapper = await mountList({ searchQuery: "algo" });
    expect(mockDocumentStore.init).toHaveBeenCalledTimes(1);

    await wrapper.setProps({ searchQuery: "" });
    await flushPromises();

    expect(mockDocumentStore.init).toHaveBeenCalledTimes(2);
  });
});
