import { mount } from "@vue/test-utils";
import { markRaw, defineComponent } from "vue";

import DocumentCard from "@/components/dynamic_document/cards/DocumentCard.vue";

const mockHandlePreviewDocument = jest.fn();
const mockDeleteDocument = jest.fn();
const mockRouterPush = jest.fn();

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock("@/components/dynamic_document/cards/index.js", () => {
  const { ref } = require("vue");

  return {
    __esModule: true,
    useCardModals: () => ({
      activeModals: ref({
        edit: { isOpen: false, document: null },
        email: { isOpen: false, document: null },
        preview: { isOpen: false, document: null },
        signatures: { isOpen: false, document: null },
        electronicSignature: { isOpen: false, document: null },
        permissions: { isOpen: false, document: null },
        letterhead: { isOpen: false, document: null },
        relationships: { isOpen: false, document: null },
      }),
      openModal: jest.fn(),
      closeModal: jest.fn(),
      closeAllModals: jest.fn(),
      getUserRole: () => "client",
    }),
    useDocumentActions: (_documentStore, _userStore, emit) => ({
      handlePreviewDocument: async (document) => {
        mockHandlePreviewDocument(document);
      },
      deleteDocument: async (document) => {
        mockDeleteDocument(document);
        emit("refresh");
      },
      downloadPDFDocument: jest.fn(),
      downloadWordDocument: jest.fn(),
      copyDocument: jest.fn(),
      publishDocument: jest.fn(),
      moveToDraft: jest.fn(),
      formalizeDocument: jest.fn(),
      signDocument: jest.fn(),
      downloadSignedDocument: jest.fn(),
    }),

    // Modal components referenced in BaseDocumentCard
    EditDocumentModal: { template: "<div />" },
    SendDocumentModal: { template: "<div />" },
    DocumentSignaturesModal: { template: "<div />" },
    ElectronicSignatureModal: { template: "<div />" },
    DocumentPermissionsModal: { template: "<div />" },
  };
});

const MenuItemStub = {
  name: "MenuItem",
  setup(_, { slots }) {
    return () => (slots.default ? slots.default({ active: false }) : null);
  },
};

const BaseDocumentCardStub = defineComponent({
  name: "BaseDocumentCard",
  props: [
    "document",
    "cardType",
    "cardContext",
    "statusIcon",
    "statusText",
    "statusBadgeClasses",
    "highlightedDocId",
    "showTags",
    "additionalClasses",
    "menuOptions",
    "disableInternalActions",
    "documentStore",
    "userStore",
    "promptDocuments",
    "editModalComponent",
    "editRoute",
  ],
  emits: ["click", "refresh", "modal-open", "navigation", "remove-from-folder"],
  template: `
    <div data-test="base-card">
      <slot name="status-badge" />
      <div data-test="slot-additional-badges"><slot name="additional-badges" /></div>
      <div data-test="slot-additional-content"><slot name="additional-content" /></div>
      <div data-test="slot-additional-actions"><slot name="additional-actions" /></div>
    </div>
  `,
});

describe("DocumentCard.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildMenuWrapper = () => {
    const doc = {
      id: 1,
      title: "My Document",
      state: "Completed",
      tags: [],
    };

    const wrapper = mount(DocumentCard, {
      props: {
        document: doc,
        cardType: "client",
        cardContext: "list",
        statusIcon: markRaw({ template: "<span />" }),
        statusText: "Completado",
        statusBadgeClasses: "bg-green-100",
        menuOptions: [
          { label: "Previsualizar", action: "preview" },
          { label: "Eliminar", action: "delete" },
        ],
        documentStore: { deleteDocument: jest.fn() },
        userStore: {
          currentUser: { id: 1, email: "test@example.com" },
          userById: jest.fn(),
        },
      },
      global: {
        stubs: {
          // HeadlessUI stubs
          Menu: { template: "<div v-bind='$attrs'><slot /></div>" },
          MenuButton: { template: "<button v-bind='$attrs'><slot /></button>" },
          MenuItems: { template: "<div v-bind='$attrs'><slot /></div>" },
          MenuItem: MenuItemStub,

          // Icons/components that are not relevant for this test
          EllipsisVerticalIcon: { template: "<span />" },
          NoSymbolIcon: { template: "<span />" },
          CheckCircleIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          HierarchicalMenu: { template: "<div />" },
          LetterheadModal: { template: "<div />" },
          DocumentRelationshipsModal: { template: "<div />" },
        },
      },
    });

    return { wrapper, doc };
  };

  test("renders title and emits click", async () => {
    const { wrapper, doc } = buildMenuWrapper();

    expect(wrapper.text()).toContain("My Document");

    await wrapper.find("[data-document-id='1']").trigger("click");

    const emittedClick = wrapper.emitted("click");
    expect(emittedClick).toBeTruthy();
    expect(emittedClick[0][0]).toEqual(doc);
    expect(emittedClick[0][1]).toEqual(expect.any(Object));
  });

  test("menu actions run preview/delete and emit refresh", async () => {
    const { wrapper, doc } = buildMenuWrapper();

    const previewBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Previsualizar");
    const deleteBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Eliminar");

    expect([Boolean(previewBtn), Boolean(deleteBtn)]).toEqual([true, true]);

    await previewBtn.trigger("click");
    await deleteBtn.trigger("click");

    expect(mockHandlePreviewDocument).toHaveBeenCalledWith(doc);
    expect(mockDeleteDocument).toHaveBeenCalledWith(doc);
    expect(wrapper.emitted("refresh")).toBeTruthy();
  });

  test("does not emit click when clicking inside menu-container", async () => {
    const doc = {
      id: 1,
      title: "My Document",
      state: "Completed",
      tags: [],
    };

    const wrapper = mount(DocumentCard, {
      props: {
        document: doc,
        cardType: "client",
        cardContext: "list",
        statusIcon: markRaw({ template: "<span />" }),
        statusText: "Completado",
        statusBadgeClasses: "bg-green-100",
        menuOptions: [{ label: "Previsualizar", action: "preview" }],
        documentStore: { deleteDocument: jest.fn() },
        userStore: {
          currentUser: { id: 1, email: "test@example.com" },
          userById: jest.fn(),
        },
      },
      global: {
        stubs: {
          Menu: { template: "<div v-bind='$attrs'><slot /></div>" },
          MenuButton: { template: "<button v-bind='$attrs'><slot /></button>" },
          MenuItems: { template: "<div v-bind='$attrs'><slot /></div>" },
          MenuItem: MenuItemStub,
          EllipsisVerticalIcon: { template: "<span />" },
          NoSymbolIcon: { template: "<span />" },
          CheckCircleIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          HierarchicalMenu: { template: "<div />" },
          LetterheadModal: { template: "<div />" },
          DocumentRelationshipsModal: { template: "<div />" },
        },
      },
    });

    const menuButton = wrapper.find("button.w-8");
    expect(menuButton.exists()).toBe(true);

    await menuButton.trigger("click");

    expect(wrapper.emitted("click")).toBeFalsy();
  });

  test("computed menuOptions: returns undefined when prop is null, and passes through when provided", async () => {
    const doc = { id: 1, title: "My Document", state: "Completed", tags: [] };

    const wrapperDefault = mount(DocumentCard, {
      props: {
        document: doc,
        cardType: "client",
        userStore: { currentUser: { id: 1 }, userById: jest.fn() },
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
        },
      },
    });

    const baseDefault = wrapperDefault.findComponent({ name: "BaseDocumentCard" });
    expect(baseDefault.exists()).toBe(true);
    expect(baseDefault.props("menuOptions")).toBeUndefined();

    const opts = [{ label: "X", action: "preview" }];
    const wrapperOverride = mount(DocumentCard, {
      props: {
        document: doc,
        cardType: "client",
        menuOptions: opts,
        userStore: { currentUser: { id: 1 }, userById: jest.fn() },
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
        },
      },
    });

    const baseOverride = wrapperOverride.findComponent({ name: "BaseDocumentCard" });
    expect(baseOverride.props("menuOptions")).toEqual(opts);
  });

  const userStore = {
    currentUser: { id: 1 },
    userById: jest.fn(),
  };

  const mountSignatureCard = ({ document, cardType = "lawyer", showSignatureProgress = false }) =>
    mount(DocumentCard, {
      props: {
        document,
        cardType,
        showSignatureProgress,
        userStore,
      },
      global: { stubs: { BaseDocumentCard: BaseDocumentCardStub } },
    });

  test("signature badge shows fully signed state for lawyer", () => {
    const wrapper = mountSignatureCard({
      document: {
        id: 1,
        title: "Doc",
        requires_signature: true,
        fully_signed: true,
        signatures: [{ signer_id: 1, signed: true }],
      },
      showSignatureProgress: true,
    });

    const badges = wrapper.find("[data-test='slot-additional-badges']");
    expect(badges.text()).toContain("Formalizado");
    expect(badges.find("div.inline-flex").classes().join(" ")).toContain(
      "bg-green-100"
    );
    expect(badges.text()).toContain("1/1");
  });

  test("signature badge shows current user signed state", () => {
    const wrapper = mountSignatureCard({
      document: {
        id: 2,
        title: "Doc",
        requires_signature: true,
        fully_signed: false,
        signatures: [
          { signer_id: 1, signed: true },
          { signer_id: 2, signed: false },
        ],
      },
    });

    const badges = wrapper.find("[data-test='slot-additional-badges']");
    expect(badges.text()).toContain("Has firmado");
    expect(badges.find("div.inline-flex").classes().join(" ")).toContain(
      "bg-blue-100"
    );
  });

  test("signature badge shows pending count for lawyer", () => {
    const wrapper = mountSignatureCard({
      document: {
        id: 3,
        title: "Doc",
        requires_signature: true,
        fully_signed: false,
        signatures: [
          { signer_id: 1, signed: false },
          { signer_id: 2, signed: true },
        ],
      },
    });

    const badges = wrapper.find("[data-test='slot-additional-badges']");
    expect(badges.text()).toContain("Firmas: 1/2");
    expect(badges.find("div.inline-flex").classes().join(" ")).toContain(
      "bg-yellow-100"
    );
  });

  test("signature badges are hidden for non-lawyer", () => {
    const wrapper = mountSignatureCard({
      document: {
        id: 4,
        title: "Doc",
        requires_signature: true,
        fully_signed: false,
        signatures: [{ signer_id: 1, signed: false }],
      },
      cardType: "client",
    });

    expect(
      wrapper.find("[data-test='slot-additional-badges']").text()
    ).toBe("");
  });

  test("signature badge shows 'Requiere firmas' and gray classes when signatures/user missing", async () => {
    const wrapper = mount(DocumentCard, {
      props: {
        document: {
          id: 5,
          title: "Doc",
          requires_signature: true,
          fully_signed: false,
          signatures: null,
        },
        cardType: "lawyer",
        userStore: { currentUser: null, userById: jest.fn() },
      },
      global: { stubs: { BaseDocumentCard: BaseDocumentCardStub } },
    });

    const badges = wrapper.find("[data-test='slot-additional-badges']");
    expect(badges.text()).toContain("Requiere firmas");
    expect(badges.find("div.inline-flex").classes().join(" ")).toContain("bg-gray-100");
  });

  test("renders client name when showClientName and assigned_to are set", async () => {
    const wrapper = mount(DocumentCard, {
      props: {
        document: {
          id: 6,
          title: "Doc",
          state: "Draft",
          tags: [],
          assigned_to: 99,
        },
        showClientName: true,
        userStore: {
          currentUser: { id: 1 },
          userById: jest.fn().mockReturnValue({ first_name: "John", last_name: "Doe" }),
        },
      },
      global: { stubs: { BaseDocumentCard: BaseDocumentCardStub } },
    });

    expect(wrapper.find("[data-test='slot-additional-content']").text()).toContain(
      "Cliente: John Doe"
    );
  });

  test("passes through BaseDocumentCard events (refresh/modal-open/navigation/remove-from-folder)", async () => {
    const doc = { id: 7, title: "Doc", state: "Draft", tags: [] };
    const wrapper = mount(DocumentCard, {
      props: {
        document: doc,
        userStore: { currentUser: { id: 1 }, userById: jest.fn() },
      },
      global: { stubs: { BaseDocumentCard: BaseDocumentCardStub } },
    });

    const base = wrapper.findComponent({ name: "BaseDocumentCard" });
    const evt = { type: "click" };
    base.vm.$emit("click", evt);
    base.vm.$emit("refresh");
    base.vm.$emit("modal-open", { name: "edit" });
    base.vm.$emit("navigation", { to: "/x" });
    base.vm.$emit("remove-from-folder", doc);

    expect(wrapper.emitted("click")).toBeTruthy();
    expect(wrapper.emitted("click")[0]).toEqual([doc, evt]);
    expect(wrapper.emitted("refresh")).toBeTruthy();
    expect(wrapper.emitted("modal-open")[0]).toEqual([{ name: "edit" }]);
    expect(wrapper.emitted("navigation")[0]).toEqual([{ to: "/x" }]);
    expect(wrapper.emitted("remove-from-folder")[0]).toEqual([doc]);
  });

  test("helper methods branches: getSignatureStatus requires_signature false and fully_signed true", async () => {
    const wrapper = mount(DocumentCard, {
      props: {
        document: { id: 8, title: "Doc", tags: [] },
        userStore: { currentUser: { id: 1 }, userById: jest.fn() },
      },
      global: { stubs: { BaseDocumentCard: BaseDocumentCardStub } },
    });

    expect(wrapper.vm.getSignatureStatus({ requires_signature: false })).toBe("");
    expect(
      wrapper.vm.getSignatureStatus({ requires_signature: true, fully_signed: true })
    ).toBe("Documento formalizado");
  });
});
