let mockDynamicDocumentStore;
let mockUserStore;

const mockShowNotification = jest.fn();
const mockSwalFire = jest.fn();
const mockGetAllColors = jest.fn();
const mockGetColorById = jest.fn();

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => mockDynamicDocumentStore,
}));

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => mockUserStore,
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/shared/color_palette", () => ({
  __esModule: true,
  getAllColors: (...args) => mockGetAllColors(...args),
  getColorById: (...args) => mockGetColorById(...args),
}));

jest.mock("sweetalert2", () => ({
  __esModule: true,
  default: {
    fire: (...args) => mockSwalFire(...args),
  },
  fire: (...args) => mockSwalFire(...args),
}));

import { useDocumentTags } from "@/composables/document-variables/useDocumentTags";

describe("useDocumentTags", () => {
  beforeEach(() => {
    mockShowNotification.mockReset();
    mockShowNotification.mockResolvedValue();
    mockSwalFire.mockReset();

    mockDynamicDocumentStore = {
      initTags: jest.fn().mockResolvedValue(),
      createTag: jest.fn().mockResolvedValue({ id: 1, name: "Nueva", color_id: 1 }),
      updateTag: jest.fn().mockResolvedValue({ id: 2, name: "Actualizada", color_id: 2 }),
      deleteTag: jest.fn().mockResolvedValue(true),
    };

    mockUserStore = {
      getCurrentUser: { role: "lawyer" },
    };

    mockGetAllColors.mockReset();
    mockGetAllColors.mockReturnValue([
      { id: 1, name: "Rojo", hex: "#f00" },
      { id: 2, name: "Azul", hex: "#00f" },
    ]);
    mockGetColorById.mockReset();
    mockGetColorById.mockReturnValue({ light: "#eee", dark: "#111" });

    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("initializeTags returns early when user is not lawyer", async () => {
    mockUserStore.getCurrentUser = { role: "client" };

    const tags = useDocumentTags();

    await tags.initializeTags({ tags: [{ id: 1, name: "A" }] });

    expect(tags.isLawyer.value).toBe(false);
    expect(mockDynamicDocumentStore.initTags).not.toHaveBeenCalled();
    expect(tags.selectedTags.value).toEqual([]);
  });

  test("initializeTags loads tags store and assigns existing tags", async () => {
    const tags = useDocumentTags();
    const documentTags = [{ id: 1, name: "A" }];

    await tags.initializeTags({ tags: documentTags });

    expect(mockDynamicDocumentStore.initTags).toHaveBeenCalled();
    expect(tags.selectedTags.value).toEqual(documentTags);
  });

  test("initializeTags clears selection when document has no tags", async () => {
    const tags = useDocumentTags();

    await tags.initializeTags({ tags: [] });

    expect(tags.selectedTags.value).toEqual([]);
  });

  test("openCreateTagModal resets tag state and opens modal", () => {
    const tags = useDocumentTags();

    tags.currentTag.value = { name: "Vieja", color_id: 2 };
    tags.isEditingTag.value = true;

    tags.openCreateTagModal();

    expect(tags.showTagModal.value).toBe(true);
    expect(tags.isEditingTag.value).toBe(false);
    expect(tags.currentTag.value).toEqual({ name: "", color_id: 1 });
  });

  test("openEditTagModal populates tag and opens modal", () => {
    const tags = useDocumentTags();

    tags.openEditTagModal({ id: 7, name: "Editable", color_id: 2 });

    expect(tags.showTagModal.value).toBe(true);
    expect(tags.isEditingTag.value).toBe(true);
    expect(tags.currentTag.value).toEqual({ id: 7, name: "Editable", color_id: 2 });
  });

  test("availableColors returns palette values", () => {
    const tags = useDocumentTags();

    expect(tags.availableColors.value).toEqual([
      { id: 1, name: "Rojo", hex: "#f00" },
      { id: 2, name: "Azul", hex: "#00f" },
    ]);
    expect(mockGetAllColors).toHaveBeenCalled();
  });

  test("closeTagModal resets modal state", () => {
    const tags = useDocumentTags();

    tags.showTagModal.value = true;
    tags.isEditingTag.value = true;
    tags.currentTag.value = { id: 7, name: "Editable", color_id: 2 };

    tags.closeTagModal();

    expect(tags.showTagModal.value).toBe(false);
    expect(tags.isEditingTag.value).toBe(false);
    expect(tags.currentTag.value).toEqual({ name: "", color_id: 1 });
  });

  test("saveTag validates name and stops when empty", async () => {
    const tags = useDocumentTags();

    tags.currentTag.value.name = "   ";

    await tags.saveTag();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "El nombre de la etiqueta es requerido",
      "error"
    );
    expect(mockDynamicDocumentStore.createTag).not.toHaveBeenCalled();
  });

  test("saveTag creates a tag and closes modal", async () => {
    const tags = useDocumentTags();

    tags.showTagModal.value = true;
    tags.currentTag.value = { name: "Nueva", color_id: 2 };

    await tags.saveTag();

    expect(mockDynamicDocumentStore.createTag).toHaveBeenCalledWith({
      name: "Nueva",
      color_id: 2,
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Etiqueta creada exitosamente",
      "success"
    );
    expect(tags.showTagModal.value).toBe(false);
  });

  test("saveTag updates a tag when editing", async () => {
    const tags = useDocumentTags();

    tags.isEditingTag.value = true;
    tags.currentTag.value = { id: 3, name: "Edit", color_id: 2 };

    await tags.saveTag();

    expect(mockDynamicDocumentStore.updateTag).toHaveBeenCalledWith(3, {
      name: "Edit",
      color_id: 2,
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Etiqueta actualizada exitosamente",
      "success"
    );
  });

  test("saveTag shows error notification on failure", async () => {
    mockDynamicDocumentStore.createTag.mockRejectedValueOnce(new Error("fail"));

    const tags = useDocumentTags();

    tags.showTagModal.value = true;
    tags.currentTag.value = { name: "Error", color_id: 1 };

    await tags.saveTag();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al guardar la etiqueta",
      "error"
    );
    expect(tags.showTagModal.value).toBe(true);
  });

  test("deleteTag does nothing when not confirmed", async () => {
    mockSwalFire.mockResolvedValueOnce({ isConfirmed: false });

    const tags = useDocumentTags();

    await tags.deleteTag({ id: 1, name: "A" });

    expect(mockDynamicDocumentStore.deleteTag).not.toHaveBeenCalled();
  });

  test("deleteTag removes selected tag when confirmed and delete succeeds", async () => {
    mockSwalFire.mockResolvedValueOnce({ isConfirmed: true });

    const tags = useDocumentTags();

    tags.selectedTags.value = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ];

    await tags.deleteTag({ id: 1, name: "A" });

    expect(mockDynamicDocumentStore.deleteTag).toHaveBeenCalledWith(1);
    expect(tags.selectedTags.value).toEqual([{ id: 2, name: "B" }]);
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Etiqueta eliminada exitosamente",
      "success"
    );
  });

  test("deleteTag shows error notification when delete fails", async () => {
    mockSwalFire.mockResolvedValueOnce({ isConfirmed: true });
    mockDynamicDocumentStore.deleteTag.mockResolvedValueOnce(false);

    const tags = useDocumentTags();

    await tags.deleteTag({ id: 1, name: "A" });

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al eliminar la etiqueta",
      "error"
    );
  });

  test("deleteTag shows error notification on exception", async () => {
    mockSwalFire.mockResolvedValueOnce({ isConfirmed: true });
    mockDynamicDocumentStore.deleteTag.mockRejectedValueOnce(new Error("fail"));

    const tags = useDocumentTags();

    await tags.deleteTag({ id: 1, name: "A" });

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al eliminar la etiqueta",
      "error"
    );
  });

  test("toggleTagSelection adds/removes tags and isTagSelected reflects state", () => {
    const tags = useDocumentTags();
    const tag = { id: 1, name: "A" };

    tags.toggleTagSelection(tag);
    expect(tags.selectedTags.value).toEqual([tag]);
    expect(tags.isTagSelected(tag)).toBe(true);

    tags.toggleTagSelection(tag);
    expect(tags.selectedTags.value).toEqual([]);
    expect(tags.isTagSelected(tag)).toBe(false);
  });

  test("getTagColorStyles uses palette color", () => {
    const tags = useDocumentTags();

    const styles = tags.getTagColorStyles(1);

    expect(mockGetColorById).toHaveBeenCalledWith(1);
    expect(styles).toEqual({
      backgroundColor: "#eee",
      borderColor: "#111",
      color: "#111",
    });
  });

  test("getTagIds returns selected tag ids", () => {
    const tags = useDocumentTags();

    tags.selectedTags.value = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ];

    expect(tags.getTagIds()).toEqual([1, 2]);
  });
});
