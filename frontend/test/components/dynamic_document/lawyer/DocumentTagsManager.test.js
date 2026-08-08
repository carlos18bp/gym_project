import { mount } from "@vue/test-utils";
import { ref, reactive, computed } from "vue";

let mockTags;
const mockStore = { tags: [], sortedTags: [] };

jest.mock("@/stores/dynamic_document", () => ({
  useDynamicDocumentStore: () => mockStore,
}));

jest.mock("@/composables/document-variables/useDocumentTags", () => ({
  useDocumentTags: () => mockTags,
}));

import DocumentTagsManager from "@/components/dynamic_document/lawyer/document-config/DocumentTagsManager.vue";

const tagsFixture = [
  { id: 1, name: "Civil", color_id: 1 },
  { id: 2, name: "Laboral", color_id: 2 },
];

const buildComposable = (overrides = {}) => ({
  selectedTags: ref([]),
  showTagModal: ref(false),
  isEditingTag: ref(false),
  currentTag: reactive({ name: "", color_id: null }),
  isLawyer: computed(() => true),
  availableColors: computed(() => [
    { id: 1, hex: "#ff0000", name: "Rojo" },
    { id: 2, hex: "#00ff00", name: "Verde" },
  ]),
  initializeTags: jest.fn().mockResolvedValue(undefined),
  openCreateTagModal: jest.fn(),
  openEditTagModal: jest.fn(),
  closeTagModal: jest.fn(),
  saveTag: jest.fn(),
  deleteTag: jest.fn(),
  toggleTagSelection: jest.fn(),
  isTagSelected: jest.fn().mockReturnValue(false),
  getTagColorStyles: jest.fn().mockReturnValue({}),
  getTagIds: jest.fn().mockReturnValue([1]),
  ...overrides,
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const mountManager = async (props = {}) => {
  const wrapper = mount(DocumentTagsManager, { props });
  await flushPromises();
  return wrapper;
};

describe("components/dynamic_document/lawyer/document-config/DocumentTagsManager.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTags = buildComposable();
    mockStore.tags = [...tagsFixture];
    mockStore.sortedTags = [...tagsFixture];
  });

  test("renders nothing for non-lawyers", async () => {
    mockTags = buildComposable({ isLawyer: computed(() => false) });
    const wrapper = await mountManager();

    expect(wrapper.text()).not.toContain("Etiquetas del Documento");
  });

  test("lists the available tags from the store", async () => {
    const wrapper = await mountManager();

    expect(wrapper.text()).toContain("Etiquetas Disponibles:");
    expect(wrapper.text()).toContain("Civil");
    expect(wrapper.text()).toContain("Laboral");
  });

  test("opens the creation modal from the new tag button", async () => {
    const wrapper = await mountManager();

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Nueva Etiqueta"))
      .trigger("click");

    expect(mockTags.openCreateTagModal).toHaveBeenCalledTimes(1);
  });

  test("toggles selection when a tag chip is clicked", async () => {
    const wrapper = await mountManager();

    await wrapper
      .findAll(".rounded-full")
      .find((c) => c.text().includes("Civil"))
      .trigger("click");

    expect(mockTags.toggleTagSelection).toHaveBeenCalledWith(tagsFixture[0]);
  });

  test("edit button opens the edit modal without toggling selection", async () => {
    const wrapper = await mountManager();

    await wrapper.find("button[title='Editar etiqueta']").trigger("click");

    expect(mockTags.openEditTagModal).toHaveBeenCalledWith(tagsFixture[0]);
    expect(mockTags.toggleTagSelection).not.toHaveBeenCalled();
  });

  test("delete button removes the tag without toggling selection", async () => {
    const wrapper = await mountManager();

    await wrapper.find("button[title='Eliminar etiqueta']").trigger("click");

    expect(mockTags.deleteTag).toHaveBeenCalledWith(tagsFixture[0]);
    expect(mockTags.toggleTagSelection).not.toHaveBeenCalled();
  });

  test("renders selected tags with a remove control", async () => {
    mockTags = buildComposable();
    mockTags.selectedTags.value = [tagsFixture[1]];
    const wrapper = await mountManager();

    expect(wrapper.text()).toContain("Etiquetas Seleccionadas:");

    await wrapper.find("button[title='Remover etiqueta']").trigger("click");

    expect(mockTags.toggleTagSelection).toHaveBeenCalledWith(tagsFixture[1]);
  });

  test("shows the empty state when there are no tags", async () => {
    mockStore.tags = [];
    mockStore.sortedTags = [];
    const wrapper = await mountManager();

    expect(wrapper.text()).toContain("No hay etiquetas disponibles.");
  });

  test("modal shows creation title, color grid and delegates save/close", async () => {
    mockTags = buildComposable();
    mockTags.showTagModal.value = true;
    const wrapper = await mountManager();

    expect(wrapper.text()).toContain("Nueva Etiqueta");
    expect(wrapper.findAll("[title='Rojo'], [title='Verde']")).toHaveLength(2);

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Crear")
      .trigger("click");
    expect(mockTags.saveTag).toHaveBeenCalled();

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Cancelar")
      .trigger("click");
    expect(mockTags.closeTagModal).toHaveBeenCalled();
  });

  test("modal shows edit labels when editing", async () => {
    mockTags = buildComposable();
    mockTags.showTagModal.value = true;
    mockTags.isEditingTag.value = true;
    const wrapper = await mountManager();

    expect(wrapper.text()).toContain("Editar Etiqueta");
    expect(wrapper.text()).toContain("Actualizar");
  });

  test("clicking a color assigns it to the current tag", async () => {
    mockTags = buildComposable();
    mockTags.showTagModal.value = true;
    const wrapper = await mountManager();

    await wrapper.find("[title='Verde']").trigger("click");

    expect(mockTags.currentTag.color_id).toBe(2);
  });

  test("initializes tags on mount when a document is provided", async () => {
    const doc = { id: 5 };
    await mountManager({ document: doc });

    expect(mockTags.initializeTags).toHaveBeenCalledWith(doc);
  });

  test("skips tag initialization without a document", async () => {
    await mountManager();

    expect(mockTags.initializeTags).not.toHaveBeenCalled();
  });

  test("exposes getTagIds to parent components", async () => {
    const wrapper = await mountManager();

    // quality: allow-implementation-coupling (getTagIds is the defineExpose public API)
    expect(wrapper.vm.getTagIds()).toEqual([1]);
    expect(mockTags.getTagIds).toHaveBeenCalled();
  });
});
