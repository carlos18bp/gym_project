import { mount } from "@vue/test-utils";

import CreateDocumentByLawyer from "@/components/dynamic_document/lawyer/modals/CreateDocumentByLawyer.vue";

const mockRouterPush = jest.fn();
const mockUpdateDocument = jest.fn();

let mockStore;

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: (...args) => mockRouterPush(...args),
  }),
}));

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => mockStore,
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  XMarkIcon: { template: "<span />" },
}));

const flushPromises = async () => {
  await Promise.resolve();
};

const findButtonByText = (wrapper, text) =>
  wrapper
    .findAll("button")
    .find((button) => (button.text() || "").includes(text));

const mountView = () => mount(CreateDocumentByLawyer);

describe("CreateDocumentByLawyer.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {
      selectedDocument: null,
      updateDocument: (...args) => mockUpdateDocument(...args),
      lastUpdatedDocumentId: null,
    };
    localStorage.clear();
    window.history.pushState({}, "", "/dynamic_document_dashboard");
    window.forceDocumentHighlight = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("create mode prevents empty submit and routes when title is set", async () => {
    const wrapper = mountView();

    await wrapper.find("form").trigger("submit.prevent");
    expect(mockRouterPush).not.toHaveBeenCalled();

    await wrapper.find("#document-name").setValue("Contrato Uno");
    await wrapper.find("form").trigger("submit.prevent");

    expect(mockStore.selectedDocument).toEqual({ title: "Contrato Uno" });
    expect(mockRouterPush).toHaveBeenCalledWith(
      "/dynamic_document_dashboard/lawyer/editor/create/Contrato%20Uno"
    );
  });

  test("edit mode updates document name and emits close", async () => {
    jest.useFakeTimers();
    mockStore = {
      selectedDocument: { id: 5, title: "Original" },
      updateDocument: (...args) => mockUpdateDocument(...args),
      lastUpdatedDocumentId: null,
    };
    mockUpdateDocument.mockResolvedValue({});

    const wrapper = mountView();
    const updateButton = findButtonByText(wrapper, "Actualizar nombre");

    expect(updateButton.attributes("disabled")).toBeDefined();

    await wrapper.find("#document-name").setValue("Actualizado");
    await findButtonByText(wrapper, "Actualizar nombre").trigger("click");
    await flushPromises();

    expect(mockUpdateDocument).toHaveBeenCalledWith(5, { title: "Actualizado" });
    expect(mockStore.selectedDocument.title).toBe("Actualizado");
    expect(mockStore.lastUpdatedDocumentId).toBe(5);
    expect(localStorage.getItem("lastUpdatedDocumentId")).toBe("5");
    expect(wrapper.emitted().close[0][0]).toEqual({ updatedDocId: 5 });

    jest.runAllTimers();
    expect(window.forceDocumentHighlight).toHaveBeenCalledWith(5);
  });

  test("edit mode submit navigates to editor and stores lastUpdatedDocumentId", async () => {
    mockStore = {
      selectedDocument: { id: 9, title: "Acta" },
      updateDocument: (...args) => mockUpdateDocument(...args),
      lastUpdatedDocumentId: null,
    };

    const wrapper = mountView();

    await wrapper.find("#document-name").setValue("Acta");
    await wrapper.find("form").trigger("submit.prevent");

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/dynamic_document_dashboard/lawyer/editor/edit/9"
    );
    expect(mockStore.lastUpdatedDocumentId).toBe(9);
    expect(localStorage.getItem("lastUpdatedDocumentId")).toBe("9");
  });

  test("emits close on Escape key", async () => {
    const wrapper = mountView();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();

    expect(wrapper.emitted().close).toBeTruthy();
  });
});
