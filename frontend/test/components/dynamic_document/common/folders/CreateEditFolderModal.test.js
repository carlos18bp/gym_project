import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useDocumentFolderStore } from "@/stores/dynamic_document/folders";

import CreateEditFolderModal from "@/components/dynamic_document/common/folders/CreateEditFolderModal.vue";

const mockShowNotification = jest.fn();

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/shared/color_palette", () => ({
  __esModule: true,
  getAllColors: () => [
    { id: 0, hex: "#3B82F6", name: "Blue" },
    { id: 1, hex: "#EF4444", name: "Red" },
    { id: 2, hex: "#10B981", name: "Green" },
  ],
}));

jest.mock("@heroicons/vue/24/outline", () => {
  const Stub = { name: "IconStub", template: "<span />" };
  return { __esModule: true, XMarkIcon: Stub };
});

jest.mock("@/components/layouts/animations/ModalTransition.vue", () => ({
  __esModule: true,
  default: {
    name: "ModalTransition",
    template: "<div><slot /></div>",
  },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function mountModal(pinia, props = {}) {
  return mount(CreateEditFolderModal, {
    props: {
      isVisible: true,
      editingFolder: null,
      ...props,
    },
    global: { plugins: [pinia] },
  });
}

describe("CreateEditFolderModal.vue", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("renders folder name input and color selection", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    expect(wrapper.find("#folderName").exists()).toBe(true);
    expect(wrapper.text()).toContain("Nombre de la carpeta");
    expect(wrapper.text()).toContain("Color de la carpeta");
  });

  test("title says 'Nueva Carpeta' in create mode", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    expect(wrapper.text()).toContain("Nueva Carpeta");
  });

  test("title says 'Editar Carpeta' in edit mode", async () => {
    const wrapper = mountModal(pinia, {
      editingFolder: { id: 1, name: "Contracts", color_id: 0 },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Editar Carpeta");
  });

  test("submit button is disabled when name is empty", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.attributes("disabled")).toBeDefined();
  });

  test("submit button is enabled when name has content", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    await wrapper.find("#folderName").setValue("My Folder"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.attributes("disabled")).toBeUndefined();
  });

  test("color selection buttons render with correct count", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    const colorBtns = wrapper.findAll("button[type='button']").filter(
      (b) => b.element.style.backgroundColor
    );
    expect(colorBtns.length).toBe(3);
  });

  test("clicking a color button updates selected color", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    const colorBtns = wrapper.findAll("button[type='button']").filter(
      (b) => b.element.style.backgroundColor
    );
    await colorBtns[1].trigger("click");
    await flushPromises();

    expect(colorBtns[1].classes()).toContain("scale-110");
  });

  test("cancel button emits close event", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    const cancelBtn = wrapper.findAll("button").find(
      (b) => b.text().includes("Cancelar")
    );
    expect(cancelBtn).toBeTruthy();

    await cancelBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("successful submit in create mode calls createFolder and emits success", async () => {
    const folderStore = useDocumentFolderStore();
    jest.spyOn(folderStore, "createFolder").mockResolvedValue({});

    const wrapper = mountModal(pinia);
    await flushPromises();

    await wrapper.find("#folderName").setValue("New Folder"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(folderStore.createFolder).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Folder" })
    );
    expect(wrapper.emitted("success")).toBeTruthy();
  });

  test("successful submit in edit mode calls updateFolder", async () => {
    const folderStore = useDocumentFolderStore();
    jest.spyOn(folderStore, "updateFolder").mockResolvedValue({});

    const wrapper = mountModal(pinia, {
      editingFolder: { id: 5, name: "Old Name", color_id: 0 },
    });
    await flushPromises();

    await wrapper.find("#folderName").setValue("Updated Folder"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(folderStore.updateFolder).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ name: "Updated Folder" })
    );
    expect(wrapper.emitted("success")).toBeTruthy();
  });

  test("edit mode pre-fills form with existing folder data", async () => {
    const wrapper = mountModal(pinia, {
      editingFolder: { id: 5, name: "Contracts", color_id: 1 },
    });
    await flushPromises();

    expect(wrapper.find("#folderName").element.value).toBe("Contracts"); // quality: allow-fragile-selector (stable DOM id)
  });

  test("submit button text changes in edit mode", async () => {
    const wrapper = mountModal(pinia, {
      editingFolder: { id: 5, name: "Contracts", color_id: 0 },
    });
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.text()).toContain("Actualizar");
  });

  test("submit button text says 'Crear' in create mode", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    await wrapper.find("#folderName").setValue("Folder"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.text()).toContain("Crear");
  });

  test("clicking overlay emits close", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    // quality: allow-fragile-selector (structural selector for modal overlay without data-testid)
    const overlay = wrapper.find(".fixed.inset-0");
    await overlay.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("form resets when visibility changes to false", async () => {
    const wrapper = mountModal(pinia);
    await flushPromises();

    await wrapper.find("#folderName").setValue("Some Folder"); // quality: allow-fragile-selector (stable DOM id)
    await flushPromises();

    await wrapper.setProps({ isVisible: false });
    await flushPromises();

    await wrapper.setProps({ isVisible: true });
    await flushPromises();

    expect(wrapper.find("#folderName").element.value).toBe(""); // quality: allow-fragile-selector (stable DOM id)
  });
});
