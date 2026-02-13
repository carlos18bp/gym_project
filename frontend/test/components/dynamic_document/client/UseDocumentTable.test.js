import { mount } from "@vue/test-utils";

import UseDocumentTable from "@/components/dynamic_document/client/UseDocumentTable.vue";

const mockRouterPush = jest.fn();

let mockDocumentStore;
let mockUserStore;

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: (...args) => mockRouterPush(...args),
  }),
}));

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => mockDocumentStore,
}));

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => mockUserStore,
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  MagnifyingGlassIcon: { template: "<span />" },
  FunnelIcon: { template: "<span />" },
  ChevronDownIcon: { template: "<span />" },
  EllipsisVerticalIcon: { template: "<span />" },
  CubeTransparentIcon: { template: "<span />" },
  XMarkIcon: { template: "<span />" },
  DocumentTextIcon: { template: "<span />" },
  ArrowLeftIcon: { template: "<span />" },
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

const findButtonByText = (wrapper, text) =>
  wrapper
    .findAll("button")
    .find((button) => (button.text() || "").includes(text));

const mountView = () =>
  mount(UseDocumentTable, {
    global: {
      stubs: {
        Menu: { template: "<div><slot /></div>" },
        MenuButton: { template: "<button><slot /></button>" },
        MenuItems: { template: "<div><slot /></div>" },
        MenuItem: MenuItemStub,
        UseDocumentByClient: { template: "<div data-test='use-modal' />" },
        ModalTransition: { template: "<div><slot /></div>" },
        Teleport: true,
      },
    },
  });

describe("UseDocumentTable.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStore = {};
    mockDocumentStore = {
      documents: [],
      init: jest.fn().mockResolvedValue(),
      publishedDocumentsUnassigned: [],
      selectedDocument: { id: 99 },
    };
  });

  test("initializes store when documents are empty", async () => {
    const wrapper = mountView();

    await flushPromises();

    expect(mockDocumentStore.init).toHaveBeenCalledWith(true);
    expect(wrapper.exists()).toBe(true);
  });

  test("emits go-back when clicking back button", async () => {
    const wrapper = mountView();

    await findButtonByText(wrapper, "Volver a Mis Documentos").trigger("click");

    expect(wrapper.emitted("go-back")).toBeTruthy();
  });

  test("opens use modal for published template", async () => {
    mockDocumentStore.publishedDocumentsUnassigned = [
      { id: 1, title: "Plantilla", state: "Published", assigned_to: null },
    ];

    const wrapper = mountView();
    await flushPromises();

    await wrapper.find("tbody tr").trigger("click");

    expect(wrapper.vm.$.setupState.showUseModal).toBe(true);
    expect(wrapper.vm.$.setupState.selectedTemplateId).toBe(1);
    expect(mockDocumentStore.selectedDocument).toBe(null);
  });

  test("navigates to editor for non-template documents", async () => {
    mockDocumentStore.publishedDocumentsUnassigned = [
      { id: 2, title: "Borrador", state: "Draft" },
    ];

    const wrapper = mountView();
    await flushPromises();

    await wrapper.find("tbody tr").trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/dynamic_document_dashboard/document/use/editor/2/Borrador"
    );
  });
});
