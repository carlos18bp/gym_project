import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useDynamicDocumentStore } from "@/stores/dynamic_document";

import UseDocumentByClient from "@/components/dynamic_document/client/modals/UseDocumentByClient.vue";

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
  return mount(UseDocumentByClient, {
    props: {
      documentId: 10,
      ...props,
    },
    global: { plugins: [pinia] },
  });
}

describe("UseDocumentByClient.vue", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders name input field and continue button", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    expect(wrapper.find("#document-name").exists()).toBe(true);
    expect(wrapper.text()).toContain("Nombre");

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.exists()).toBe(true);
    expect(submitBtn.text()).toContain("Continuar");
  });

  test("continue button is disabled when title is empty", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.attributes("disabled")).toBeDefined();
  });

  test("continue button is enabled when title has content", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    await wrapper.find("#document-name").setValue("My Document"); // quality: allow-fragile-selector (stable DOM id)
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

  test("submit with documentId but no selectedDocument navigates to creator route", async () => {
    const wrapper = mountModal(pinia, { documentId: 10 });
    await flushPromises();

    await wrapper.find("#document-name").setValue("New Doc"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining("/dynamic_document_dashboard/document/use/creator/10/")
    );
  });

  test("submit with selectedDocument navigates to editor route", async () => {
    const store = useDynamicDocumentStore();
    store.selectedDocument = { id: 5, title: "Existing Doc" };

    const wrapper = mountModal(pinia, { documentId: null });
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining("/dynamic_document_dashboard/document/use/editor/5/")
    );
  });

  test("edit mode shows 'Actualizar nombre' button", async () => {
    const store = useDynamicDocumentStore();
    store.selectedDocument = { id: 5, title: "Existing Doc" };

    const wrapper = mountModal(pinia);
    await flushPromises();

    const updateBtn = wrapper.findAll("button").find(
      (b) => b.text().includes("Actualizar nombre")
    );
    expect(updateBtn).toBeTruthy();
  });

  test("'Actualizar nombre' is disabled when title unchanged", async () => {
    const store = useDynamicDocumentStore();
    store.selectedDocument = { id: 5, title: "Existing Doc" };

    const wrapper = mountModal(pinia);
    await flushPromises();

    const updateBtn = wrapper.findAll("button").find(
      (b) => b.text().includes("Actualizar nombre")
    );
    expect(updateBtn.attributes("disabled")).toBeDefined();
  });

  test("'Actualizar nombre' becomes enabled when title is changed", async () => {
    const store = useDynamicDocumentStore();
    store.selectedDocument = { id: 5, title: "Existing Doc" };

    const wrapper = mountModal(pinia);
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
    store.selectedDocument = { id: 5, title: "Existing Doc" };
    jest.spyOn(store, "updateDocument").mockResolvedValue({});

    const wrapper = mountModal(pinia);
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
      "Document name successfully updated.",
      "success"
    );
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("updateDocumentName error shows error notification", async () => {
    const store = useDynamicDocumentStore();
    store.selectedDocument = { id: 5, title: "Existing Doc" };
    jest.spyOn(store, "updateDocument").mockRejectedValue(new Error("fail"));

    const wrapper = mountModal(pinia);
    await flushPromises();

    await wrapper.find("#document-name").setValue("Updated Title"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    const updateBtn = wrapper.findAll("button").find(
      (b) => b.text().includes("Actualizar nombre")
    );
    await updateBtn.trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error updating document name.",
      "error"
    );
  });

  test("in edit mode, submit button text says 'Editar Documento'", async () => {
    const store = useDynamicDocumentStore();
    store.selectedDocument = { id: 5, title: "Doc" };

    const wrapper = mountModal(pinia);
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.text()).toContain("Editar Documento");
  });

  test("submit without documentId or selectedDocument shows error", async () => {
    const wrapper = mountModal(pinia, { documentId: null });
    await flushPromises();

    await wrapper.find("#document-name").setValue("Some Doc"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("No se pudo continuar"),
      "error"
    );
  });
});
