import { mount } from "@vue/test-utils";
import { ref } from "vue";

import DocumentActionsModal from "@/components/dynamic_document/common/DocumentActionsModal.vue";

let mockMenuOptions = [];
const mockHandleFeatureAccess = jest.fn();
const mockIsBasicUser = ref(false);

jest.mock("@/components/dynamic_document/cards/menuOptionsHelper.js", () => ({
  __esModule: true,
  getMenuOptionsForCardType: () => mockMenuOptions,
}));

jest.mock("@/composables/useBasicUserRestrictions", () => ({
  __esModule: true,
  useBasicUserRestrictions: () => ({
    isBasicUser: mockIsBasicUser,
    handleFeatureAccess: (...args) => mockHandleFeatureAccess(...args),
  }),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  XMarkIcon: { template: "<span />" },
  DocumentIcon: { template: "<span />" },
  PencilIcon: { template: "<span />" },
  TrashIcon: { template: "<span />" },
  EyeIcon: { template: "<span />" },
  DocumentDuplicateIcon: { template: "<span />" },
  PaperClipIcon: { template: "<span />" },
  EnvelopeIcon: { template: "<span />" },
  ArrowDownTrayIcon: { template: "<span />" },
  UserGroupIcon: { template: "<span />" },
  LockClosedIcon: { template: "<span />" },
  LinkIcon: { template: "<span />" },
  CheckCircleIcon: { template: "<span />" },
  PencilSquareIcon: { template: "<span />" },
  NoSymbolIcon: { template: "<span />" },
  DocumentTextIcon: { template: "<span />" },
  PhotoIcon: { template: "<span />" },
  ShareIcon: { template: "<span />" },
  XCircleIcon: { template: "<span />" },
  HandThumbDownIcon: { template: "<span />" },
}));

const ModalTransitionStub = { template: "<div><slot /></div>" };

const buildWrapper = (props = {}) =>
  mount(DocumentActionsModal, {
    props: {
      isVisible: true,
      cardType: "lawyer",
      context: "table",
      document: { id: 1, title: "Doc", state: "Completed" },
      userStore: { currentUser: { role: "lawyer" } },
      ...props,
    },
    global: {
      stubs: {
        ModalTransition: ModalTransitionStub,
      },
    },
  });

describe("DocumentActionsModal.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMenuOptions = [];
    mockIsBasicUser.value = false;
  });

  test("renders empty state when no options are available", () => {
    const wrapper = buildWrapper();

    expect(wrapper.text()).toContain("No hay acciones disponibles");
  });

  test("groups options and emits action on click", async () => {
    mockMenuOptions = [
      { action: "preview", label: "Previsualizar" },
      { action: "downloadPDF", label: "Descargar PDF" },
      { action: "delete", label: "Eliminar" },
      { action: "relationships", label: "Relaciones" },
      { action: "sign", label: "Firmar" },
      {
        action: "edit-submenu",
        children: [{ action: "editDocument", label: "Editar Documento" }],
      },
    ];

    const wrapper = buildWrapper();

    expect(wrapper.text()).toContain("Edición");
    expect(wrapper.text()).toContain("Visualización");
    expect(wrapper.text()).toContain("Compartir");
    expect(wrapper.text()).toContain("Firmas");
    expect(wrapper.text()).toContain("Gestión");
    expect(wrapper.text()).toContain("Eliminación");

    const editButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Editar Documento"));

    await editButton.trigger("click");

    expect(wrapper.emitted("action")[0]).toEqual([
      "editDocument",
      { id: 1, title: "Doc", state: "Completed" },
    ]);
  });

  test("disabled option triggers restriction handler and does not emit action", async () => {
    mockMenuOptions = [
      { action: "relationships", label: "Relaciones", disabled: true },
    ];

    const wrapper = buildWrapper();
    const actionButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Relaciones"));

    expect(actionButton.attributes("disabled")).toBeDefined();

    await wrapper.vm.$.setupState.handleAction("relationships");

    expect(mockHandleFeatureAccess).toHaveBeenCalledWith(
      "Esta funcionalidad",
      null
    );
    expect(wrapper.emitted("action")).toBeUndefined();
  });
});
