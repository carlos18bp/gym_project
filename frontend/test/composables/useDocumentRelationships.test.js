const mockGetAvailableDocumentsForRelationship = jest.fn();
const mockGetRelatedDocuments = jest.fn();
const mockGetDocumentRelationships = jest.fn();
const mockCreateDocumentRelationship = jest.fn();
const mockDeleteDocumentRelationship = jest.fn();

jest.mock("@/stores/dynamic_document/relationships", () => ({
  __esModule: true,
  documentRelationshipsActions: {
    getAvailableDocumentsForRelationship: (...args) =>
      mockGetAvailableDocumentsForRelationship(...args),
    getRelatedDocuments: (...args) => mockGetRelatedDocuments(...args),
    getDocumentRelationships: (...args) => mockGetDocumentRelationships(...args),
    createDocumentRelationship: (...args) => mockCreateDocumentRelationship(...args),
    deleteDocumentRelationship: (...args) => mockDeleteDocumentRelationship(...args),
  },
}));

import { useDocumentRelationships } from "@/composables/useDocumentRelationships";

describe("useDocumentRelationships", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAvailableDocumentsForRelationship.mockResolvedValue([]);
    mockGetRelatedDocuments.mockResolvedValue([]);
    mockGetDocumentRelationships.mockResolvedValue([]);
    mockCreateDocumentRelationship.mockResolvedValue({ id: 1 });
    mockDeleteDocumentRelationship.mockResolvedValue(true);

    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
    console.error.mockRestore();
  });

  test("loadAvailableDocuments: does nothing when documentId is missing", async () => {
    const { loadAvailableDocuments, isLoadingAvailable, availableDocuments } =
      useDocumentRelationships(null);

    await loadAvailableDocuments();

    expect(mockGetAvailableDocumentsForRelationship).not.toHaveBeenCalled();
    expect(isLoadingAvailable.value).toBe(false);
    expect(availableDocuments.value).toEqual([]);
  });

  test("loadRelatedDocuments: does nothing when documentId is missing", async () => {
    const { loadRelatedDocuments, isLoadingRelated, relatedDocuments } =
      useDocumentRelationships(null);

    await loadRelatedDocuments();

    expect(mockGetRelatedDocuments).not.toHaveBeenCalled();
    expect(isLoadingRelated.value).toBe(false);
    expect(relatedDocuments.value).toEqual([]);
  });

  test("loadRelationships: does nothing when documentId is missing", async () => {
    const { loadRelationships, isLoadingRelationships, relationships } =
      useDocumentRelationships(null);

    await loadRelationships();

    expect(mockGetDocumentRelationships).not.toHaveBeenCalled();
    expect(isLoadingRelationships.value).toBe(false);
    expect(relationships.value).toEqual([]);
  });

  test("loadAvailableDocuments: loads and sets availableDocuments", async () => {
    const docs = [
      { id: 1, state: "Completed" },
      { id: 2, state: "Draft" },
    ];

    mockGetAvailableDocumentsForRelationship.mockResolvedValueOnce(docs);

    const { loadAvailableDocuments, isLoadingAvailable, availableDocuments } =
      useDocumentRelationships(10);

    const p = loadAvailableDocuments();
    expect(isLoadingAvailable.value).toBe(true);

    await p;

    expect(mockGetAvailableDocumentsForRelationship).toHaveBeenCalledWith(10, {
      allowPendingSignatures: undefined,
    });
    expect(isLoadingAvailable.value).toBe(false);
    expect(availableDocuments.value).toEqual(docs);
  });

  test("loadAvailableDocuments: applies Completed filter via options.filterCompleted", async () => {
    const docs = [
      { id: 1, state: "Completed" },
      { id: 2, state: "Draft" },
      { id: 3, state: "FullySigned" },
    ];

    mockGetAvailableDocumentsForRelationship.mockResolvedValueOnce(docs);

    const { loadAvailableDocuments, availableDocuments } = useDocumentRelationships(
      10,
      { filterCompleted: true }
    );

    await loadAvailableDocuments();

    expect(availableDocuments.value).toEqual([{ id: 1, state: "Completed" }]);
  });

  test("loadAvailableDocuments: applies FullySigned filter via options", async () => {
    const docs = [
      { id: 1, state: "Completed" },
      { id: 2, state: "FullySigned" },
    ];

    mockGetAvailableDocumentsForRelationship.mockResolvedValueOnce(docs);

    const { loadAvailableDocuments, availableDocuments } = useDocumentRelationships(
      10,
      { filterFullySigned: true }
    );

    await loadAvailableDocuments();

    expect(availableDocuments.value).toEqual([{ id: 2, state: "FullySigned" }]);
  });

  test("loadAvailableDocuments: applies FullySigned filter via filterOptions", async () => {
    const docs = [
      { id: 1, state: "Completed" },
      { id: 2, state: "FullySigned" },
    ];

    mockGetAvailableDocumentsForRelationship.mockResolvedValueOnce(docs);

    const { loadAvailableDocuments, availableDocuments } = useDocumentRelationships(10);

    await loadAvailableDocuments({ filterFullySigned: true });

    expect(availableDocuments.value).toEqual([{ id: 2, state: "FullySigned" }]);
  });

  test("loadAvailableDocuments: filterOptions.filterCompleted has precedence over filterFullySigned", async () => {
    const docs = [
      { id: 1, state: "Completed" },
      { id: 2, state: "FullySigned" },
    ];

    mockGetAvailableDocumentsForRelationship.mockResolvedValueOnce(docs);

    const { loadAvailableDocuments, availableDocuments } = useDocumentRelationships(
      10,
      { filterFullySigned: true }
    );

    await loadAvailableDocuments({ filterCompleted: true, filterFullySigned: true });

    expect(availableDocuments.value).toEqual([{ id: 1, state: "Completed" }]);
  });

  test("loadAvailableDocuments: handles 404 gracefully (warn + empty array, no throw)", async () => {
    mockGetAvailableDocumentsForRelationship.mockRejectedValueOnce({
      response: { status: 404 },
    });

    const { loadAvailableDocuments, availableDocuments, isLoadingAvailable } =
      useDocumentRelationships(10);

    await expect(loadAvailableDocuments()).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith(
      "Document 10 not found when loading available documents"
    );
    expect(availableDocuments.value).toEqual([]);
    expect(isLoadingAvailable.value).toBe(false);
  });

  test("loadAvailableDocuments: throws on non-404 errors and clears array", async () => {
    mockGetAvailableDocumentsForRelationship.mockRejectedValueOnce(
      new Error("fail")
    );

    const { loadAvailableDocuments, availableDocuments, isLoadingAvailable } =
      useDocumentRelationships(10);

    await expect(loadAvailableDocuments()).rejects.toBeTruthy();

    expect(console.error).toHaveBeenCalled();
    expect(availableDocuments.value).toEqual([]);
    expect(isLoadingAvailable.value).toBe(false);
  });

  test("loadRelatedDocuments: handles 404 gracefully (warn + empty array, no throw)", async () => {
    mockGetRelatedDocuments.mockRejectedValueOnce({ response: { status: 404 } });

    const { loadRelatedDocuments, relatedDocuments, isLoadingRelated } =
      useDocumentRelationships(22);

    await expect(loadRelatedDocuments()).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith(
      "Document 22 not found when loading related documents"
    );
    expect(relatedDocuments.value).toEqual([]);
    expect(isLoadingRelated.value).toBe(false);
  });

  test("loadRelatedDocuments: throws on non-404 errors and clears array", async () => {
    mockGetRelatedDocuments.mockRejectedValueOnce(new Error("fail"));

    const { loadRelatedDocuments, relatedDocuments, isLoadingRelated } =
      useDocumentRelationships(22);

    await expect(loadRelatedDocuments()).rejects.toBeTruthy();

    expect(relatedDocuments.value).toEqual([]);
    expect(isLoadingRelated.value).toBe(false);
  });

  test("loadRelationships: handles 404 gracefully (warn + empty array, no throw)", async () => {
    mockGetDocumentRelationships.mockRejectedValueOnce({
      response: { status: 404 },
    });

    const { loadRelationships, relationships, isLoadingRelationships } =
      useDocumentRelationships(33);

    await expect(loadRelationships()).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith(
      "Document 33 not found when loading relationships"
    );
    expect(relationships.value).toEqual([]);
    expect(isLoadingRelationships.value).toBe(false);
  });

  test("loadRelationships: throws on non-404 errors and clears array", async () => {
    mockGetDocumentRelationships.mockRejectedValueOnce(new Error("fail"));

    const { loadRelationships, relationships, isLoadingRelationships } =
      useDocumentRelationships(33);

    await expect(loadRelationships()).rejects.toBeTruthy();

    expect(console.error).toHaveBeenCalled();
    expect(relationships.value).toEqual([]);
    expect(isLoadingRelationships.value).toBe(false);
  });

  test("createRelationship: toggles isLoading and returns created relationship", async () => {
    mockCreateDocumentRelationship.mockResolvedValueOnce({ id: 99 });

    const { createRelationship, isLoading } = useDocumentRelationships(10);

    const p = createRelationship({ source_document: 1, target_document: 2 });
    expect(isLoading.value).toBe(true);

    const result = await p;

    expect(result).toEqual({ id: 99 });
    expect(isLoading.value).toBe(false);
    expect(mockCreateDocumentRelationship).toHaveBeenCalledWith({
      source_document: 1,
      target_document: 2,
    });
  });

  test("createRelationship: logs and rethrows on error", async () => {
    const error = new Error("fail");
    mockCreateDocumentRelationship.mockRejectedValueOnce(error);

    const { createRelationship, isLoading } = useDocumentRelationships(10);

    await expect(createRelationship({})).rejects.toBe(error);

    expect(mockCreateDocumentRelationship).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(isLoading.value).toBe(false);
  });

  test("deleteRelationship: toggles isLoading and returns result", async () => {
    mockDeleteDocumentRelationship.mockResolvedValueOnce(false);

    const { deleteRelationship, isLoading } = useDocumentRelationships(10);

    const p = deleteRelationship(123);
    expect(isLoading.value).toBe(true);

    const result = await p;

    expect(result).toBe(false);
    expect(isLoading.value).toBe(false);
    expect(mockDeleteDocumentRelationship).toHaveBeenCalledWith(123);
  });

  test("deleteRelationship: logs and rethrows on error", async () => {
    const error = new Error("fail");
    mockDeleteDocumentRelationship.mockRejectedValueOnce(error);

    const { deleteRelationship, isLoading } = useDocumentRelationships(10);

    await expect(deleteRelationship(1)).rejects.toBe(error);

    expect(mockDeleteDocumentRelationship).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(isLoading.value).toBe(false);
  });

  test("findRelationship and areDocumentsRelated work bidirectionally", () => {
    const { relationships, findRelationship, areDocumentsRelated } =
      useDocumentRelationships(10);

    relationships.value = [
      { source_document: 1, target_document: 2, id: 100 },
      { source_document: 3, target_document: 4, id: 200 },
    ];

    expect(findRelationship(1, 2)).toEqual({
      source_document: 1,
      target_document: 2,
      id: 100,
    });

    expect(findRelationship(2, 1)).toEqual({
      source_document: 1,
      target_document: 2,
      id: 100,
    });

    expect(findRelationship(1, 3)).toBeUndefined();

    expect(areDocumentsRelated(3, 4)).toBe(true);
    expect(areDocumentsRelated(4, 3)).toBe(true);
    expect(areDocumentsRelated(1, 3)).toBe(false);
  });

  test("loadAllData calls all loaders", async () => {
    const { loadAllData } = useDocumentRelationships(77);

    await loadAllData();

    expect(mockGetAvailableDocumentsForRelationship).toHaveBeenCalledWith(77, {
      allowPendingSignatures: undefined,
    });
    expect(mockGetRelatedDocuments).toHaveBeenCalledWith(77);
    expect(mockGetDocumentRelationships).toHaveBeenCalledWith(77);
  });
});
