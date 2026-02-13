import { mount } from "@vue/test-utils";
import { markRaw } from "vue";

import BaseDocumentCard from "@/components/dynamic_document/cards/BaseDocumentCard.vue";

const mockHandlePreviewDocument = jest.fn();
const mockDeleteDocument = jest.fn();
const mockRouterPush = jest.fn();
const mockOpenModal = jest.fn();
const mockCloseModal = jest.fn();

const mockDownloadPDFDocument = jest.fn();
const mockDownloadWordDocument = jest.fn();
const mockCopyDocument = jest.fn();
const mockPublishDocument = jest.fn();
const mockMoveToDraft = jest.fn();
const mockFormalizeDocument = jest.fn();
const mockSignDocument = jest.fn();
const mockDownloadSignedDocument = jest.fn();

var mockActiveModalsRef;

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  EllipsisVerticalIcon: { name: "EllipsisVerticalIcon", template: "<span />" },
  NoSymbolIcon: { name: "NoSymbolIcon", template: "<span data-test='no-symbol' />" },
  CheckCircleIcon: { name: "CheckCircleIcon", template: "<span data-test='status-check' />" },
  PencilIcon: { name: "PencilIcon", template: "<span data-test='status-pencil' />" },
}));

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock("@/composables/useRecentViews", () => ({
  __esModule: true,
  useRecentViews: () => ({
    registerView: jest.fn(),
  }),
}));

jest.mock("@/shared/color_palette", () => ({
  __esModule: true,
  getColorById: () => null,
}));

jest.mock("@/components/dynamic_document/cards/index.js", () => {
  const { ref } = require("vue");

  if (!mockActiveModalsRef) {
    mockActiveModalsRef = ref({
      edit: { isOpen: false, document: null },
      email: { isOpen: false, document: null },
      preview: { isOpen: false, document: null },
      signatures: { isOpen: false, document: null },
      electronicSignature: { isOpen: false, document: null },
      permissions: { isOpen: false, document: null },
      letterhead: { isOpen: false, document: null },
      relationships: { isOpen: false, document: null },
    });
  }

  return {
    __esModule: true,
    useCardModals: () => ({
      activeModals: mockActiveModalsRef,
      openModal: (...args) => mockOpenModal(...args),
      closeModal: (...args) => mockCloseModal(...args),
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
      downloadPDFDocument: async (document) => mockDownloadPDFDocument(document),
      downloadWordDocument: async (document) => mockDownloadWordDocument(document),
      copyDocument: async (document) => mockCopyDocument(document),
      publishDocument: async (document) => mockPublishDocument(document),
      moveToDraft: async (document) => mockMoveToDraft(document),
      formalizeDocument: async (document) => mockFormalizeDocument(document),
      signDocument: async (document, openModal) => mockSignDocument(document, openModal),
      downloadSignedDocument: async (document) => mockDownloadSignedDocument(document),
    }),

    EditDocumentModal: {
      props: ["document", "userRole"],
      template:
        "<div data-test='modal-edit'><button data-test='close-edit' type='button' @click=\"$emit('close')\">x</button></div>",
    },
    SendDocumentModal: {
      props: ["document"],
      template:
        "<div data-test='modal-email'><button data-test='close-email' type='button' @click=\"$emit('close')\">x</button></div>",
    },
    DocumentSignaturesModal: {
      props: ["documentId"],
      template:
        "<div data-test='modal-signatures'><button data-test='close-signatures' type='button' @click=\"$emit('close')\">x</button><button data-test='refresh-signatures' type='button' @click=\"$emit('refresh')\">r</button></div>",
    },
    ElectronicSignatureModal: {
      template:
        "<div data-test='modal-electronic'><button data-test='close-electronic' type='button' @click=\"$emit('close')\">x</button></div>",
    },
    DocumentPermissionsModal: {
      props: ["isOpen", "document"],
      template:
        "<div data-test='modal-permissions'><button data-test='close-permissions' type='button' @click=\"$emit('close')\">x</button><button data-test='saved-permissions' type='button' @click=\"$emit('saved')\">s</button></div>",
    },
  };
});

const MenuItemStub = {
  name: "MenuItem",
  setup(_, { slots }) {
    return () => (slots.default ? slots.default({ active: false }) : null);
  },
};

const HierarchicalMenuStub = {
  name: "HierarchicalMenu",
  props: ["menuItems", "menuPosition"],
  emits: ["menu-action"],
  computed: {
    flatMenuItems() {
      const flatten = (items) => {
        const result = [];
        (items || []).forEach((item) => {
          if (!item) return;
          if (item.divider) return;
          if (Array.isArray(item.children)) {
            result.push(...flatten(item.children));
            return;
          }
          if (item.action && item.label) {
            result.push(item);
          }
        });
        return result;
      };

      return flatten(this.menuItems);
    },
  },
  template:
    "<div data-test='hierarchical-menu'><button v-for='item in flatMenuItems' :key='item.label' type='button' :disabled='item.disabled' @click=\"$emit('menu-action', item.action)\">{{ item.label }}</button></div>",
};

describe("BaseDocumentCard.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    if (mockActiveModalsRef && mockActiveModalsRef.value) {
      Object.values(mockActiveModalsRef.value).forEach((m) => {
        m.isOpen = false;
        m.document = null;
      });
    }
  });

  const baseProps = (overrides = {}) => {
    const { document: documentOverrides, ...rest } = overrides;

    return {
      document: {
        id: 1,
        title: "My Document",
        state: "Draft",
        tags: [],
        ...documentOverrides,
      },
      cardType: "client",
      cardContext: "list",
      statusIcon: markRaw({ template: "<span />" }),
      statusText: "Estado",
      documentStore: {},
      userStore: { currentUser: { email: "test@example.com" } },
      ...rest,
    };
  };

  const basePropsDerivedStatus = (overrides = {}) => {
    const { document: documentOverrides, ...rest } = overrides;

    return {
      document: {
        id: 1,
        title: "My Document",
        state: "Draft",
        tags: [],
        ...documentOverrides,
      },
      cardType: "client",
      cardContext: "list",
      documentStore: {},
      userStore: { currentUser: { email: "test@example.com" } },
      ...rest,
    };
  };

  const globalStubs = {
    Menu: { template: "<div v-bind='$attrs' class='menu-container'><slot /></div>" },
    MenuButton: { template: "<button v-bind='$attrs'><slot /></button>" },
    MenuItems: { template: "<div v-bind='$attrs'><slot /></div>" },
    MenuItem: MenuItemStub,

    EllipsisVerticalIcon: { template: "<span />" },
    NoSymbolIcon: { template: "<span data-test='no-symbol' />" },
    CheckCircleIcon: { template: "<span data-test='status-check' />" },
    PencilIcon: { template: "<span data-test='status-pencil' />" },

    HierarchicalMenu: HierarchicalMenuStub,

    LetterheadModal: {
      template:
        "<div data-test='modal-letterhead'><button data-test='close-letterhead' type='button' @click=\"$emit('close')\">x</button><button data-test='uploaded-letterhead' type='button' @click=\"$emit('uploaded')\">u</button><button data-test='deleted-letterhead' type='button' @click=\"$emit('deleted')\">d</button></div>",
    },
    DocumentRelationshipsModal: {
      template:
        "<div data-test='modal-relationships'><button data-test='close-relationships' type='button' @click=\"$emit('close')\">x</button><button data-test='refresh-relationships' type='button' @click=\"$emit('refresh')\">r</button></div>",
    },
  };

  test("emits click when clicking card, but not when clicking inside menu-container", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: baseProps({
        menuOptions: [{ label: "Previsualizar", action: "preview" }],
      }),
      global: {
        stubs: globalStubs,
      },
    });

    await wrapper.find("[data-document-id='1']").trigger("click");

    expect(wrapper.emitted("click")).toBeTruthy();

    const before = wrapper.emitted("click").length;

    const menuButton = wrapper.find("button.w-8");
    expect(menuButton.exists()).toBe(true);

    await menuButton.trigger("click");

    expect(wrapper.emitted("click").length).toBe(before);
  });

  test("runs preview/delete actions from menu and emits refresh", async () => {
    const doc = { id: 1, title: "My Document", state: "Completed", tags: [] };

    const wrapper = mount(BaseDocumentCard, {
      props: baseProps({
        document: doc,
        menuOptions: [
          { label: "Previsualizar", action: "preview" },
          { label: "Eliminar", action: "delete" },
        ],
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const previewBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Previsualizar");
    const deleteBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Eliminar");

    expect(previewBtn).toBeTruthy();
    expect(deleteBtn).toBeTruthy();

    await previewBtn.trigger("click");
    expect(mockHandlePreviewDocument).toHaveBeenCalledWith(doc);

    await deleteBtn.trigger("click");
    expect(mockDeleteDocument).toHaveBeenCalledWith(doc);
    expect(wrapper.emitted("refresh")).toBeTruthy();
  });

  test("client Draft menu includes Completar and does not include Previsualizar", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: baseProps({
        document: { state: "Draft" },
      }),
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.text()).toContain("My Document");

    const texts = wrapper
      .findAll("button")
      .map((b) => (b.text() || "").trim())
      .filter(Boolean);

    expect(texts).toContain("Completar");
    expect(texts).toContain("Eliminar");
    expect(texts).not.toContain("Previsualizar");
  });

  test("client Completed uses hierarchical menu and includes Previsualizar option", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: baseProps({
        document: { state: "Completed" },
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const menu = wrapper.find("[data-test='hierarchical-menu']");
    expect(menu.exists()).toBe(true);

    const texts = menu
      .findAll("button")
      .map((b) => (b.text() || "").trim())
      .filter(Boolean);

    expect(texts).toContain("Previsualizar");
  });

  test("default cardType includes remove-from-folder action in folder context", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "default",
        cardContext: "folder",
        document: { id: 2, title: "Default Doc", state: "Draft", tags: [] },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const removeBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Quitar de Carpeta");

    expect(removeBtn).toBeTruthy();
    await removeBtn.trigger("click");

    expect(wrapper.emitted("remove-from-folder")).toBeTruthy();
  });

  test("client folder context includes relationships and remove-from-folder actions", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "client",
        cardContext: "folder",
        document: { id: 3, title: "Client Doc", state: "Completed", tags: [] },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const relationshipsBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Administrar Asociaciones");
    const removeBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Quitar de Carpeta");

    expect(relationshipsBtn).toBeTruthy();
    expect(removeBtn).toBeTruthy();

    await relationshipsBtn.trigger("click");
    expect(mockOpenModal).toHaveBeenCalledWith(
      "relationships",
      expect.objectContaining({ id: 3 })
    );

    await removeBtn.trigger("click");
    expect(wrapper.emitted("remove-from-folder")).toBeTruthy();
  });

  test("menuPosition uses promptDocuments responsive positioning", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: baseProps({
        promptDocuments: true,
        document: { state: "Completed" },
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const menuComp = wrapper.findComponent({ name: "HierarchicalMenu" });
    expect(menuComp.exists()).toBe(true);
    expect(menuComp.props("menuPosition")).toContain("sm:-translate-x");
  });

  test("derives status icon/text/badge classes and card/highlight classes from document state", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        document: { state: "Published" },
        highlightedDocId: 1,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.find("[data-test='status-check']").exists()).toBe(true);
    expect(wrapper.text()).toContain("Publicado");

    const root = wrapper.find("[data-document-id='1']");
    const cls = () => root.classes().join(" ");

    expect(cls()).toContain("border-green-400");
    expect(cls()).toContain("animate-pulse-highlight-green");

    await wrapper.setProps({
      document: { id: 1, title: "My Document", state: "PendingSignatures", tags: [] },
      highlightedDocId: 1,
    });

    expect(wrapper.find("[data-test='status-pencil']").exists()).toBe(true);
    expect(wrapper.text()).toContain("Pendiente de firmas");
    expect(cls()).toContain("border-yellow-400");
    expect(cls()).toContain("animate-pulse-highlight-yellow");

    await wrapper.setProps({
      document: { id: 1, title: "My Document", state: "Draft", tags: [] },
      highlightedDocId: 1,
    });

    expect(wrapper.text()).toContain("Borrador");
    expect(cls()).toContain("border-blue-300");
    expect(cls()).toContain("animate-pulse-highlight-blue");
  });

  test("showMenuOptions=false hides menu when menuOptions is null, but menuOptions override still renders", async () => {
    const wrapperHidden = mount(BaseDocumentCard, {
      props: baseProps({
        showMenuOptions: false,
        menuOptions: null,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapperHidden.find("button.w-8").exists()).toBe(false);
    expect(wrapperHidden.find("[data-test='hierarchical-menu']").exists()).toBe(false);

    const wrapperOverride = mount(BaseDocumentCard, {
      props: baseProps({
        showMenuOptions: false,
        menuOptions: [{ label: "Descargar PDF", action: "downloadPDF" }],
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const pdfBtn = wrapperOverride
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Descargar PDF");
    expect(pdfBtn).toBeTruthy();
    await pdfBtn.trigger("click");
    expect(mockDownloadPDFDocument).toHaveBeenCalled();
  });

  test("showMenuOptions=true returns empty menu when cardType is unknown", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: baseProps({
        cardType: "unknown",
        showMenuOptions: true,
        menuOptions: null,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.find("button.w-8").exists()).toBe(false);
    expect(wrapper.find("[data-test='hierarchical-menu']").exists()).toBe(false);
  });

  test("client Completed edit submenu triggers editForm modal and editDocument navigation", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: baseProps({
        cardType: "client",
        document: { id: 1, title: "My Document", state: "Completed", tags: [] },
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const menu = wrapper.find("[data-test='hierarchical-menu']");
    expect(menu.exists()).toBe(true);

    const editFormBtn = menu
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Editar Formulario");
    const editDocBtn = menu
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Editar Documento");

    expect(editFormBtn).toBeTruthy();
    expect(editDocBtn).toBeTruthy();

    await editFormBtn.trigger("click");
    expect(mockOpenModal).toHaveBeenCalledWith(
      "edit",
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ userRole: "client" })
    );

    await editDocBtn.trigger("click");
    expect(mockRouterPush).toHaveBeenCalledWith("/dynamic_document_dashboard/client/editor/edit/1");
  });

  test("edit action navigates using editRoute when provided, otherwise opens edit modal", async () => {
    const doc = { id: 7, title: "My Doc", state: "Draft", tags: [] };

    const wrapperNav = mount(BaseDocumentCard, {
      props: baseProps({
        cardType: "lawyer",
        document: doc,
        editRoute: "/editor/:id/:title",
        showMenuOptions: true,
        menuOptions: null,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const menuNav = wrapperNav.find("[data-test='hierarchical-menu']");
    expect(menuNav.exists()).toBe(true);

    const editBtnNav = menuNav
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Editar");
    expect(editBtnNav).toBeTruthy();
    await editBtnNav.trigger("click");
    expect(mockRouterPush).toHaveBeenCalledWith("/editor/7/My%20Doc");

    const wrapperModal = mount(BaseDocumentCard, {
      props: baseProps({
        cardType: "lawyer",
        document: doc,
        editRoute: null,
        showMenuOptions: true,
        menuOptions: null,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const menuModal = wrapperModal.find("[data-test='hierarchical-menu']");
    expect(menuModal.exists()).toBe(true);

    const editBtnModal = menuModal
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Editar");
    expect(editBtnModal).toBeTruthy();
    await editBtnModal.trigger("click");

    expect(mockOpenModal).toHaveBeenCalledWith(
      "edit",
      expect.objectContaining({ id: 7 }),
      expect.objectContaining({ userRole: "client" })
    );
  });

  test("lawyer Draft publish option disabled when variables missing name_es, enabled otherwise", async () => {
    const wrapperDisabled = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "lawyer",
        document: {
          id: 9,
          title: "Doc",
          state: "Draft",
          variables: [{ name_es: "" }],
        },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const menuDisabled = wrapperDisabled.find("[data-test='hierarchical-menu']");
    expect(menuDisabled.exists()).toBe(true);

    const publishBtnDisabled = menuDisabled
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Publicar");
    expect(publishBtnDisabled).toBeTruthy();
    expect(publishBtnDisabled.attributes("disabled")).toBeDefined();

    const wrapperEnabled = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "lawyer",
        document: {
          id: 10,
          title: "Doc 2",
          state: "Draft",
          variables: [{ name_es: "Nombre" }],
        },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const menuEnabled = wrapperEnabled.find("[data-test='hierarchical-menu']");
    const publishBtnEnabled = menuEnabled
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Publicar");
    expect(publishBtnEnabled).toBeTruthy();
    expect(publishBtnEnabled.attributes("disabled")).toBeUndefined();
    await publishBtnEnabled.trigger("click");
    expect(mockPublishDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
  });

  test("lawyer pending signatures adds view/sign actions when user can sign", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "lawyer",
        document: {
          id: 99,
          title: "Sig Doc",
          state: "PendingSignatures",
          requires_signature: true,
          signatures: [{ signer_email: "test@example.com", signed: false }],
          tags: [],
        },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const menu = wrapper.find("[data-test='hierarchical-menu']");
    expect(menu.exists()).toBe(true);

    const viewBtn = menu
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Ver Firmas");
    const signBtn = menu
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Firmar documento");

    expect(viewBtn).toBeTruthy();
    expect(signBtn).toBeTruthy();

    await viewBtn.trigger("click");
    expect(mockOpenModal).toHaveBeenCalledWith(
      "signatures",
      expect.objectContaining({ id: 99 })
    );

    await signBtn.trigger("click");
    expect(mockSignDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99 }),
      expect.any(Function)
    );
  });

  test("organizedMenuItems returns empty array when menuOptions are empty", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: baseProps({
        showMenuOptions: false,
        menuOptions: null,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.vm.organizedMenuItems).toEqual([]);
  });

  test("status text/classes cover progress/completed/fully signed and unknown", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        document: { id: 1, title: "Doc", state: "Progress", tags: [] },
      }),
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.text()).toContain("En progreso");
    expect(wrapper.find("[data-test='status-pencil']").exists()).toBe(true);

    await wrapper.setProps({
      document: { id: 1, title: "Doc", state: "Completed", tags: [] },
    });
    expect(wrapper.text()).toContain("Completado");
    expect(wrapper.find("[data-test='status-check']").exists()).toBe(true);

    await wrapper.setProps({
      document: { id: 1, title: "Doc", state: "FullySigned", tags: [] },
    });
    expect(wrapper.text()).toContain("Completamente firmado");
    expect(wrapper.find("[data-test='status-check']").exists()).toBe(true);

    await wrapper.setProps({
      document: { id: 1, title: "Doc", state: "Unknown", tags: [] },
    });
    expect(wrapper.text()).toContain("Desconocido");

    const badge = wrapper.find("div.inline-flex");
    expect(badge.classes()).toEqual(
      expect.arrayContaining(["bg-gray-100", "text-gray-700"])
    );

    const root = wrapper.find("[data-document-id='1']");
    expect(root.classes()).toContain("border-gray-200");
  });

  test("lawyer Published menu actions call store actions and open email modal", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "lawyer",
        document: {
          id: 11,
          title: "Doc 3",
          state: "Published",
          variables: [],
        },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const menu = wrapper.find("[data-test='hierarchical-menu']");
    expect(menu.exists()).toBe(true);

    const byText = (t) =>
      menu.findAll("button").find((b) => (b.text() || "").trim() === t);

    await byText("Mover a Borrador").trigger("click");
    expect(mockMoveToDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 11 }));

    await byText("Formalizar y Agregar Firmas").trigger("click");
    expect(mockFormalizeDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 11 }));

    await byText("Descargar PDF").trigger("click");
    expect(mockDownloadPDFDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 11 }));

    await byText("Descargar Word").trigger("click");
    expect(mockDownloadWordDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 11 }));

    await byText("Enviar por Email").trigger("click");
    expect(mockOpenModal).toHaveBeenCalledWith(
      "email",
      expect.objectContaining({ id: 11 })
    );
  });

  test("lawyer common actions: permissions/relationships/copy/letterhead trigger expected handlers", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "lawyer",
        document: {
          id: 12,
          title: "Doc 4",
          state: "Draft",
          variables: [],
        },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const menu = wrapper.find("[data-test='hierarchical-menu']");
    expect(menu.exists()).toBe(true);

    const click = async (t) => {
      const b = menu.findAll("button").find((x) => (x.text() || "").trim() === t);
      expect(b).toBeTruthy();
      await b.trigger("click");
    };

    await click("Permisos");
    expect(mockOpenModal).toHaveBeenCalledWith(
      "permissions",
      expect.objectContaining({ id: 12 })
    );

    await click("Crear una Copia");
    expect(mockCopyDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));

    await click("Gestionar Membrete");
    expect(mockOpenModal).toHaveBeenCalledWith(
      "letterhead",
      expect.objectContaining({ id: 12 })
    );
  });

  test("handleMenuAction catches action errors and logs", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockPublishDocument.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const wrapper = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "lawyer",
        document: {
          id: 13,
          title: "Doc 5",
          state: "Draft",
          variables: [],
        },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const menu = wrapper.find("[data-test='hierarchical-menu']");
    const publishBtn = menu
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Publicar");
    expect(publishBtn).toBeTruthy();
    await publishBtn.trigger("click");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error executing action publish:",
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });

  test("signatures cardType exposes signature actions and canSignDocument branches", async () => {
    const baseDoc = {
      id: 20,
      title: "Sig Doc",
      requires_signature: true,
      signatures: [
        { signer_email: "test@example.com", signed: false },
        { signer_email: "other@example.com", signed: true },
      ],
      tags: [],
    };

    const wrapperPending = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "signatures",
        cardContext: "folder",
        document: {
          ...baseDoc,
          state: "PendingSignatures",
        },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const textsPending = wrapperPending
      .findAll("button")
      .map((b) => (b.text() || "").trim())
      .filter(Boolean);

    expect(textsPending).toContain("Estado de las firmas");
    expect(textsPending).toContain("Firmar documento");
    expect(textsPending).toContain("Descargar PDF");
    expect(textsPending).toContain("Quitar de Carpeta");

    const clickPending = async (label) => {
      const b = wrapperPending
        .findAll("button")
        .find((x) => (x.text() || "").trim() === label);
      expect(b).toBeTruthy();
      await b.trigger("click");
    };

    await clickPending("Estado de las firmas");
    expect(mockOpenModal).toHaveBeenCalledWith(
      "signatures",
      expect.objectContaining({ id: 20 })
    );

    await clickPending("Firmar documento");
    expect(mockSignDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: 20 }),
      expect.any(Function)
    );

    await clickPending("Descargar PDF");
    expect(mockDownloadPDFDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 20 }));

    await clickPending("Quitar de Carpeta");
    expect(wrapperPending.emitted("remove-from-folder")).toBeTruthy();

    const wrapperFullySigned = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "signatures",
        document: {
          ...baseDoc,
          state: "FullySigned",
        },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const textsSigned = wrapperFullySigned
      .findAll("button")
      .map((b) => (b.text() || "").trim())
      .filter(Boolean);
    expect(textsSigned).toContain("Descargar Documento firmado");

    const dlSignedBtn = wrapperFullySigned
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Descargar Documento firmado");
    await dlSignedBtn.trigger("click");
    expect(mockDownloadSignedDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: 20 })
    );

    const wrapperCantSign = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "signatures",
        document: {
          ...baseDoc,
          state: "PendingSignatures",
          signatures: [{ signer_email: "test@example.com", signed: true }],
        },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const textsCantSign = wrapperCantSign
      .findAll("button")
      .map((b) => (b.text() || "").trim())
      .filter(Boolean);
    expect(textsCantSign).not.toContain("Firmar documento");
  });

  test("signatures cardType hides sign when signatures missing or user not listed", async () => {
    const wrapperNoSignatures = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "signatures",
        document: {
          id: 21,
          title: "Sig Doc",
          state: "PendingSignatures",
          requires_signature: true,
          signatures: [],
          tags: [],
        },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const textsNoSignatures = wrapperNoSignatures
      .findAll("button")
      .map((b) => (b.text() || "").trim())
      .filter(Boolean);
    expect(textsNoSignatures).not.toContain("Firmar documento");

    const wrapperNoUser = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "signatures",
        document: {
          id: 22,
          title: "Sig Doc",
          state: "PendingSignatures",
          requires_signature: true,
          signatures: [{ signer_email: "other@example.com", signed: false }],
          tags: [],
        },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const textsNoUser = wrapperNoUser
      .findAll("button")
      .map((b) => (b.text() || "").trim())
      .filter(Boolean);
    expect(textsNoUser).not.toContain("Firmar documento");
  });

  test("covers useDocument/use branches and unknown-action warn", async () => {
    const doc = { id: 30, title: "Default", state: "Draft", tags: [] };

    const wrapperDefault = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "default",
        document: doc,
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const useBtn = wrapperDefault
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Usar Formato");
    expect(useBtn).toBeTruthy();
    await useBtn.trigger("click");
    expect(wrapperDefault.emitted("click")).toBeTruthy();

    const wrapperUse = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        document: doc,
        menuOptions: [
          { label: "Use", action: "use" },
          { label: "Mystery", action: "mystery" },
        ],
      }),
      global: {
        stubs: globalStubs,
      },
    });

    const useActionBtn = wrapperUse
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Use");
    await useActionBtn.trigger("click");
    expect(wrapperUse.emitted("menuAction")).toBeTruthy();
    expect(wrapperUse.emitted("menuAction")[0]).toEqual(["use", doc]);

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const unknownBtn = wrapperUse
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Mystery");
    await unknownBtn.trigger("click");
    expect(consoleWarnSpy).toHaveBeenCalledWith("Unknown action:", "mystery");
    consoleWarnSpy.mockRestore();
  });

  test("modal close and refresh wiring: signatures/permissions/letterhead/relationships", async () => {
    const wrapper = mount(BaseDocumentCard, {
      props: basePropsDerivedStatus({
        cardType: "lawyer",
        document: { id: 40, title: "Doc", state: "Published", variables: [], tags: [] },
        showMenuOptions: true,
      }),
      global: {
        stubs: globalStubs,
      },
    });

    mockActiveModalsRef.value.signatures.isOpen = true;
    mockActiveModalsRef.value.signatures.document = { id: 40 };
    mockActiveModalsRef.value.permissions.isOpen = true;
    mockActiveModalsRef.value.permissions.document = { id: 40 };
    mockActiveModalsRef.value.letterhead.isOpen = true;
    mockActiveModalsRef.value.letterhead.document = { id: 40 };
    mockActiveModalsRef.value.relationships.isOpen = true;
    mockActiveModalsRef.value.relationships.document = { id: 40 };
    await wrapper.vm.$nextTick();

    expect(wrapper.find("[data-test='modal-signatures']").exists()).toBe(true);
    expect(wrapper.find("[data-test='modal-permissions']").exists()).toBe(true);
    expect(wrapper.find("[data-test='modal-letterhead']").exists()).toBe(true);
    expect(wrapper.find("[data-test='modal-relationships']").exists()).toBe(true);

    await wrapper.find("[data-test='refresh-signatures']").trigger("click");
    expect(wrapper.emitted("refresh")).toBeTruthy();

    await wrapper.find("[data-test='saved-permissions']").trigger("click");
    expect(wrapper.emitted("refresh")).toBeTruthy();

    await wrapper.find("[data-test='uploaded-letterhead']").trigger("click");
    await wrapper.find("[data-test='deleted-letterhead']").trigger("click");
    expect(wrapper.emitted("refresh")).toBeTruthy();

    await wrapper.find("[data-test='refresh-relationships']").trigger("click");
    expect(wrapper.emitted("refresh")).toBeTruthy();

    await wrapper.find("[data-test='close-signatures']").trigger("click");
    await wrapper.find("[data-test='close-permissions']").trigger("click");
    await wrapper.find("[data-test='close-letterhead']").trigger("click");
    await wrapper.find("[data-test='close-relationships']").trigger("click");

    expect(mockCloseModal).toHaveBeenCalledWith("signatures");
    expect(mockCloseModal).toHaveBeenCalledWith("permissions");
    expect(mockCloseModal).toHaveBeenCalledWith("letterhead");
    expect(mockCloseModal).toHaveBeenCalledWith("relationships");
  });
});
