const mockGetRequest = jest.fn();
const mockCreateRequest = jest.fn();
const mockPatchRequest = jest.fn();
const mockDeleteRequest = jest.fn();
const mockGetAllColors = jest.fn();
const mockGetColorById = jest.fn();
const mockShowNotification = jest.fn(() => Promise.resolve());

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: (...args) => mockGetRequest(...args),
  create_request: (...args) => mockCreateRequest(...args),
  patch_request: (...args) => mockPatchRequest(...args),
  delete_request: (...args) => mockDeleteRequest(...args),
}));

jest.mock("@/shared/color_palette", () => ({
  __esModule: true,
  getAllColors: (...args) => mockGetAllColors(...args),
  getColorById: (...args) => mockGetColorById(...args),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

import { setActivePinia, createPinia } from "pinia";
import { useDocumentFolderStore } from "@/stores/dynamic_document/folders";

const buildFolder = (overrides = {}) => ({
  id: 1,
  name: "Folder",
  color_id: 0,
  created_at: "2026-01-01T00:00:00Z",
  document_ids: [1, 2],
  ...overrides,
});

const setupStore = () => {
  setActivePinia(createPinia());
  return useDocumentFolderStore();
};

const seedFolders = (store) => {
  store.folders = [
    buildFolder({ id: 1, created_at: "2026-01-01T00:00:00Z", color_id: 1 }),
    buildFolder({ id: 2, created_at: "2026-01-02T00:00:00Z", color_id: 0, document_ids: null }),
  ];
};

describe("Document Folders Store", () => {
  beforeEach(() => {
    mockGetRequest.mockReset();
    mockCreateRequest.mockReset();
    mockPatchRequest.mockReset();
    mockDeleteRequest.mockReset();
    mockGetAllColors.mockReset();
    mockGetColorById.mockReset();
    mockShowNotification.mockClear();

    mockGetAllColors.mockReturnValue([{ id: 0 }, { id: 1 }]);
    mockGetColorById.mockImplementation((id) => ({ id, hex: `#${id}` }));
  });

  test("initial state and available colors", () => {
    const store = setupStore();

    expect(store.folders).toEqual([]);
    expect(store.currentFolder).toBe(null);
    expect(store.error).toBe(null);
    expect(store.lastUpdatedFolderId).toBe(null);
    expect(store.availableColors).toEqual([{ id: 0 }, { id: 1 }]);
  });

  test("getters return sorted folders and lookup by id/color", () => {
    const store = setupStore();

    seedFolders(store);

    expect([
      store.sortedFolders.map((folder) => folder.id),
      store.getFolderById(1)?.id,
      store.getFolderById(999),
      store.getFoldersByColor(1).map((folder) => folder.id),
    ]).toEqual([[2, 1], 1, undefined, [1]]);
  });

  test("getters return color metadata and totals", () => {
    const store = setupStore();

    seedFolders(store);

    const withColor = store.getFolderWithColor(1);
    expect([
      withColor.color,
      store.getFolderWithColor(999),
      store.getFoldersContainingDocument(1).map((folder) => folder.id),
      store.totalDocumentsInFolders,
      store.hasFolders,
    ]).toEqual([{ id: 1, hex: "#1" }, null, [1], 2, true]);
  });

  test("init returns early when folders already loaded", async () => {
    const store = setupStore();
    store.folders = [buildFolder()];

    const fetchSpy = jest.spyOn(store, "fetchFolders");

    await store.init();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("init calls fetchFolders and handles error", async () => {
    const store = setupStore();

    const fetchSpy = jest.spyOn(store, "fetchFolders").mockRejectedValue(new Error("fail"));

    await store.init();

    expect(fetchSpy).toHaveBeenCalled();
    expect(store.error).toBe("Error al inicializar las carpetas");
    expect(store.isLoading).toBe(false);
  });

  test("fetchFolders handles success and non-200 responses", async () => {
    const store = setupStore();

    mockGetRequest.mockResolvedValueOnce({ status: 200, data: [buildFolder()] });

    const result = await store.fetchFolders();

    expect(result).toHaveLength(1);
    expect(store.folders).toHaveLength(1);

    mockGetRequest.mockResolvedValueOnce({ status: 500, data: [] });

    await expect(store.fetchFolders()).rejects.toBeTruthy();
    expect(store.error).toBe("Error al obtener las carpetas");
  });

  test("fetchFolder updates existing folder", async () => {
    const store = setupStore();
    store.folders = [buildFolder({ id: 1, name: "Old" })];

    mockGetRequest.mockResolvedValueOnce({ status: 200, data: buildFolder({ id: 1, name: "New" }) });

    const result = await store.fetchFolder(1);

    expect(result.name).toBe("New");
    expect(store.folders[0].name).toBe("New");
    expect(store.currentFolder?.id).toBe(1);
  });

  test("fetchFolder adds new folder and handles error status", async () => {
    const store = setupStore();

    mockGetRequest.mockResolvedValueOnce({ status: 200, data: buildFolder({ id: 2 }) });

    const result = await store.fetchFolder(2);

    expect(result.id).toBe(2);
    expect(store.folders).toHaveLength(1);

    mockGetRequest.mockResolvedValueOnce({ status: 404, data: {} });

    await expect(store.fetchFolder(3)).rejects.toBeTruthy();
    expect(store.error).toBe("Error al obtener la carpeta");
  });

  test("createFolder validates name, color, and handles errors", async () => {
    const store = setupStore();

    await expect(store.createFolder({ name: "" })).rejects.toBeTruthy();
    expect(store.error).toBe("El nombre de la carpeta es requerido");
    expect(mockShowNotification).toHaveBeenCalledWith(
      "El nombre de la carpeta es requerido",
      "error"
    );

    await expect(store.createFolder({ name: "Valid", color_id: 9 })).rejects.toBeTruthy();
    expect(store.error).toBe("Color de carpeta no válido");

    mockCreateRequest.mockResolvedValueOnce({ status: 400, data: {} });

    await expect(store.createFolder({ name: "Test" })).rejects.toBeTruthy();
    expect(store.error).toBe("Error creating folder: 400");
  });

  test("createFolder succeeds and uses defaults", async () => {
    const store = setupStore();

    mockCreateRequest.mockResolvedValueOnce({
      status: 201,
      data: buildFolder({ id: 10, name: "Nueva", color_id: 0, document_ids: [7] }),
    });

    const result = await store.createFolder({ name: " Nueva ", document_ids: [7] });

    expect(result.id).toBe(10);
    expect(store.folders[0].id).toBe(10);
    expect(store.lastUpdatedFolderId).toBe(10);
    expect(mockCreateRequest).toHaveBeenCalledWith(
      "dynamic-documents/folders/create/",
      {
        name: "Nueva",
        color_id: 0,
        document_ids: [7],
      }
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Carpeta creada exitosamente",
      "success"
    );
  });

  test("createFolder uses fallback error message when error lacks message", async () => {
    const store = setupStore();

    mockCreateRequest.mockRejectedValueOnce({});

    await expect(store.createFolder({ name: "Valid" })).rejects.toBeTruthy();

    expect(store.error).toBe("Error al crear la carpeta");
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al crear la carpeta",
      "error"
    );
  });

  test("updateFolder validates input and handles non-200 responses", async () => {
    const store = setupStore();

    await expect(store.updateFolder(1, { name: "   " })).rejects.toBeTruthy();
    expect(store.error).toBe("El nombre de la carpeta no puede estar vacío");

    await expect(store.updateFolder(1, { color_id: 9 })).rejects.toBeTruthy();
    expect(store.error).toBe("Color de carpeta no válido");

    mockPatchRequest.mockResolvedValueOnce({ status: 500, data: {} });
    await expect(store.updateFolder(1, { name: "Nuevo" })).rejects.toBeTruthy();
    expect(store.error).toBe("Error updating folder: 500");
  });

  test("updateFolder updates folder and currentFolder when present", async () => {
    const store = setupStore();

    store.folders = [buildFolder({ id: 1, name: "Old" })];
    store.currentFolder = buildFolder({ id: 1, name: "Old" });

    mockPatchRequest.mockResolvedValueOnce({
      status: 200,
      data: buildFolder({ id: 1, name: "Updated", color_id: 1 }),
    });

    const result = await store.updateFolder(1, {
      name: " Updated ",
      color_id: 1,
      document_ids: [1],
    });

    expect(result.name).toBe("Updated");
    expect(store.folders[0].name).toBe("Updated");
    expect(store.currentFolder?.name).toBe("Updated");
    expect(store.lastUpdatedFolderId).toBe(1);
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Carpeta actualizada exitosamente",
      "success"
    );
  });

  test("updateFolder builds payload without name when not provided", async () => {
    const store = setupStore();

    mockPatchRequest.mockResolvedValueOnce({
      status: 200,
      data: buildFolder({ id: 3, color_id: 1, document_ids: [9] }),
    });

    await store.updateFolder(3, { color_id: 1, document_ids: [9] });

    expect(mockPatchRequest).toHaveBeenCalledWith(
      "dynamic-documents/folders/3/update/",
      { color_id: 1, document_ids: [9] }
    );
  });

  test("updateFolder uses fallback error message when error lacks message", async () => {
    const store = setupStore();

    mockPatchRequest.mockRejectedValueOnce({});

    await expect(store.updateFolder(4, { color_id: 1 })).rejects.toBeTruthy();

    expect(store.error).toBe("Error al actualizar la carpeta");
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al actualizar la carpeta",
      "error"
    );
  });

  test("updateFolder leaves state when folder is not cached", async () => {
    const store = setupStore();

    mockPatchRequest.mockResolvedValueOnce({
      status: 200,
      data: buildFolder({ id: 5, name: "Remote" }),
    });

    const result = await store.updateFolder(5, { name: "Remote" });

    expect(result.id).toBe(5);
    expect(store.folders).toEqual([]);
    expect(store.currentFolder).toBe(null);
  });

  test("deleteFolder handles 204 and clears current folder", async () => {
    const store = setupStore();

    store.folders = [buildFolder({ id: 1 }), buildFolder({ id: 2 })];
    store.currentFolder = buildFolder({ id: 1 });

    mockDeleteRequest.mockResolvedValueOnce({ status: 204 });

    const result = await store.deleteFolder(1);

    expect(result).toBe(true);
    expect(store.folders.map((folder) => folder.id)).toEqual([2]);
    expect(store.currentFolder).toBe(null);
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Carpeta eliminada exitosamente",
      "success"
    );
  });

  test("deleteFolder handles 200 and preserves different current folder", async () => {
    const store = setupStore();

    store.folders = [buildFolder({ id: 1 }), buildFolder({ id: 2 })];
    store.currentFolder = buildFolder({ id: 2 });

    mockDeleteRequest.mockResolvedValueOnce({ status: 200 });

    const result = await store.deleteFolder(1);

    expect(result).toBe(true);
    expect(store.folders.map((folder) => folder.id)).toEqual([2]);
    expect(store.currentFolder?.id).toBe(2);
  });

  test("deleteFolder handles error with fallback message", async () => {
    const store = setupStore();

    const error = new Error();
    error.message = "";
    mockDeleteRequest.mockRejectedValueOnce(error);

    await expect(store.deleteFolder(99)).rejects.toBeTruthy();

    expect(store.error).toBe("Error al eliminar la carpeta");
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al eliminar la carpeta",
      "error"
    );
  });

  test("deleteFolder throws when status is not 200/204", async () => {
    const store = setupStore();

    mockDeleteRequest.mockResolvedValueOnce({ status: 500 });

    await expect(store.deleteFolder(5)).rejects.toBeTruthy();

    expect(store.error).toBe("Error deleting folder: 500");
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error deleting folder: 500",
      "error"
    );
  });

  test("setCurrentFolder, clearCurrentFolder, and reset work", () => {
    const store = setupStore();

    store.setCurrentFolder(buildFolder());
    expect(store.currentFolder).toBeTruthy();

    store.clearCurrentFolder();
    expect(store.currentFolder).toBe(null);

    store.folders = [buildFolder()];
    store.error = "err";
    store.lastUpdatedFolderId = 1;
    store.reset();

    expect(store.folders).toEqual([]);
    expect(store.error).toBe(null);
    expect(store.lastUpdatedFolderId).toBe(null);
  });

  test("utility actions add/remove documents and handle missing folders", async () => {
    const store = setupStore();

    await expect(store.addDocumentsToFolder(1, [1])).rejects.toBeTruthy();
    await expect(store.removeDocumentsFromFolder(1, [1])).rejects.toBeTruthy();

    store.folders = [buildFolder({ id: 1, document_ids: [1, 2, 3] })];

    const updateSpy = jest.spyOn(store, "updateFolder").mockResolvedValue({});

    await store.addDocumentsToFolder(1, [2, 4]);
    expect(updateSpy).toHaveBeenCalledWith(1, { document_ids: [1, 2, 3, 4] });

    await store.removeDocumentsFromFolder(1, [2]);
    expect(updateSpy).toHaveBeenCalledWith(1, { document_ids: [1, 3] });
  });

  test("utility actions handle missing document_ids", async () => {
    const store = setupStore();

    store.folders = [buildFolder({ id: 2, document_ids: undefined })];

    const updateSpy = jest.spyOn(store, "updateFolder").mockResolvedValue({});

    await store.addDocumentsToFolder(2, [9]);
    expect(updateSpy).toHaveBeenCalledWith(2, { document_ids: [9] });

    await store.removeDocumentsFromFolder(2, [9]);
    expect(updateSpy).toHaveBeenCalledWith(2, { document_ids: [] });
  });

  test("moveDocumentsBetweenFolders calls helpers and notifies", async () => {
    const store = setupStore();

    const removeSpy = jest.spyOn(store, "removeDocumentsFromFolder").mockResolvedValue({});
    const addSpy = jest.spyOn(store, "addDocumentsToFolder").mockResolvedValue({});

    await store.moveDocumentsBetweenFolders([1], 2, 3);

    expect(removeSpy).toHaveBeenCalledWith(2, [1]);
    expect(addSpy).toHaveBeenCalledWith(3, [1]);
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Documentos movidos exitosamente",
      "success"
    );
  });

  test("moveDocumentsBetweenFolders skips missing from/to folders", async () => {
    const store = setupStore();

    const removeSpy = jest.spyOn(store, "removeDocumentsFromFolder").mockResolvedValue({});
    const addSpy = jest.spyOn(store, "addDocumentsToFolder").mockResolvedValue({});

    await store.moveDocumentsBetweenFolders([1], null, 3);
    expect(removeSpy).not.toHaveBeenCalled();
    expect(addSpy).toHaveBeenCalledWith(3, [1]);

    removeSpy.mockClear();
    addSpy.mockClear();

    await store.moveDocumentsBetweenFolders([1], 2, null);
    expect(removeSpy).toHaveBeenCalledWith(2, [1]);
    expect(addSpy).not.toHaveBeenCalled();
  });

  test("moveDocumentsBetweenFolders handles errors", async () => {
    const store = setupStore();

    jest.spyOn(store, "removeDocumentsFromFolder").mockRejectedValue(new Error("fail"));

    await expect(store.moveDocumentsBetweenFolders([1], 2, 3)).rejects.toBeTruthy();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al mover documentos",
      "error"
    );
  });

  test("getFolderColor returns specific or fallback color", () => {
    const store = setupStore();

    store.folders = [buildFolder({ id: 1, color_id: 1 })];

    expect(store.getFolderColor(1)).toEqual({ id: 1, hex: "#1" });
    expect(store.getFolderColor(999)).toEqual({ id: 0, hex: "#0" });
  });

  test("validateFolderData returns error list and valid state", () => {
    const store = setupStore();

    const invalid = store.validateFolderData({
      name: "",
      color_id: 5,
      document_ids: "bad",
    });

    expect(invalid.isValid).toBe(false);
    expect(invalid.errors).toEqual(
      expect.arrayContaining([
        "El nombre de la carpeta es requerido",
        "Color de carpeta no válido",
        "Los IDs de documentos deben ser un array",
      ])
    );

    const longName = store.validateFolderData({ name: "x".repeat(101) });
    expect(longName.errors).toContain(
      "El nombre de la carpeta no puede exceder 100 caracteres"
    );

    const valid = store.validateFolderData({ name: "Ok", color_id: 1, document_ids: [] });
    expect(valid.isValid).toBe(true);
    expect(valid.errors).toEqual([]);
  });
});
