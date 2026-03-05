import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useDynamicDocumentStore } from "@/stores/dynamic_document";

import EditDocumentModal from "@/components/dynamic_document/cards/modals/EditDocumentModal.vue";

const mockShowNotification = jest.fn();
const mockRouterPush = jest.fn();

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("vue-router", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("@heroicons/vue/24/outline", () => {
  const Stub = { name: "IconStub", template: "<span />" };
  return { __esModule: true, XMarkIcon: Stub };
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function mountModal(pinia, props = {}) {
  return mount(EditDocumentModal, {
    props: {
      document: { id: 1, title: "Original Title" },
      userRole: "lawyer",
      showEditorButton: true,
      ...props,
    },
    global: { plugins: [pinia] },
  });
}

describe("EditDocumentModal.vue", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders name input with document title", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    const input = wrapper.find("#document-name");
    expect(input.exists()).toBe(true);
    expect(input.element.value).toBe("Original Title");
  });

  test("continue button is disabled when title is empty", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    await wrapper.find("#document-name").setValue(""); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.attributes("disabled")).toBeDefined();
  });

  test("continue button is enabled when title has content", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.attributes("disabled")).toBeUndefined();
  });

  test("close button emits close event", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    const closeBtn = wrapper.findAll("button").find(
      (b) => b.findComponent({ name: "IconStub" }).exists()
    );
    await closeBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("clicking overlay emits close event", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (structural selector for modal overlay without data-testid)
    await wrapper.find(".fixed.inset-0").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("edit mode shows 'Actualizar nombre' button", async () => {
    const wrapper = mountModal(pinia, { document: { id: 5, title: "Existing" } });
    await flushPromises();

    const updateBtn = wrapper.findAll("button").find(
      (b) => b.text().includes("Actualizar nombre")
    );
    expect(updateBtn).toBeTruthy();
  });

  test("'Actualizar nombre' is disabled when title unchanged", async () => {
    const wrapper = mountModal(pinia, { document: { id: 5, title: "Existing" } });
    await flushPromises();

    const updateBtn = wrapper.findAll("button").find(
      (b) => b.text().includes("Actualizar nombre")
    );
    expect(updateBtn.attributes("disabled")).toBeDefined();
  });

  test("'Actualizar nombre' becomes enabled when title is changed", async () => {
    const wrapper = mountModal(pinia, { document: { id: 5, title: "Existing" } });
    await flushPromises();

    await wrapper.find("#document-name").setValue("New Title"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    const updateBtn = wrapper.findAll("button").find(
      (b) => b.text().includes("Actualizar nombre")
    );
    expect(updateBtn.attributes("disabled")).toBeUndefined();
  });

  test("clicking 'Actualizar nombre' calls updateDocument and shows success", async () => {
    const store = useDynamicDocumentStore();
    jest.spyOn(store, "updateDocument").mockResolvedValue({});

    const wrapper = mountModal(pinia, { document: { id: 5, title: "Existing" } });
    await flushPromises();

    await wrapper.find("#document-name").setValue("Updated Title"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    const updateBtn = wrapper.findAll("button").find(
      (b) => b.text().includes("Actualizar nombre")
    );
    await updateBtn.trigger("click");
    await flushPromises();

    expect(store.updateDocument).toHaveBeenCalledWith(5, { title: "Updated Title" });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Nombre del documento actualizado exitosamente.",
      "success"
    );
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("updateDocumentName error shows error notification", async () => {
    const store = useDynamicDocumentStore();
    jest.spyOn(store, "updateDocument").mockRejectedValue(new Error("fail"));

    const wrapper = mountModal(pinia, { document: { id: 5, title: "Existing" } });
    await flushPromises();

    await wrapper.find("#document-name").setValue("Updated Title"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    const updateBtn = wrapper.findAll("button").find(
      (b) => b.text().includes("Actualizar nombre")
    );
    await updateBtn.trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al actualizar el nombre del documento.",
      "error"
    );
  });

  test("submit in edit mode navigates to editor for lawyer", async () => {
    const wrapper = mountModal(pinia, {
      document: { id: 5, title: "Doc" },
      userRole: "lawyer",
    });
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/dynamic_document_dashboard/lawyer/editor/edit/5"
    );
  });

  test("submit in edit mode navigates to document use for client", async () => {
    const wrapper = mountModal(pinia, {
      document: { id: 5, title: "My Doc" },
      userRole: "client",
    });
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining("/dynamic_document_dashboard/document/use/editor/5/")
    );
  });

  test("showEditorButton=false hides the submit button in edit mode", async () => {
    const wrapper = mountModal(pinia, {
      document: { id: 5, title: "Doc" },
      showEditorButton: false,
    });
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.exists()).toBe(false);
  });

  test("in edit mode, submit button text says 'Editar Documento'", async () => {
    const wrapper = mountModal(pinia, { document: { id: 5, title: "Doc" } });
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.text()).toContain("Editar Documento");
  });
});
