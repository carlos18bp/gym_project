import { setActivePinia, createPinia } from "pinia";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";

describe("Dynamic Document Store - Getters and Filters", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("documentById returns cached document when available", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [{ id: 1, title: "FromList" }],
      documentCache: { 1: { id: 1, title: "FromCache" } },
    });

    expect(store.documentById(1)).toEqual({ id: 1, title: "FromCache" });
  });

  test("documentById returns document from list when not cached", () => {
    const store = useDynamicDocumentStore();

    store.$patch({ documents: [{ id: 2, title: "InList" }] });

    expect(store.documentById(2)).toEqual({ id: 2, title: "InList" });
    expect(store.documentById(999)).toBe(null);
  });

  test("tagById returns tag or null", () => {
    const store = useDynamicDocumentStore();

    store.$patch({ tags: [{ id: 10, name: "A" }] });

    expect(store.tagById(10)).toEqual({ id: 10, name: "A" });
    expect(store.tagById(11)).toBe(null);
  });

  test("sortedTags sorts tags alphabetically by name", () => {
    const store = useDynamicDocumentStore();

    store.$patch({ tags: [{ id: 1, name: "Z" }, { id: 2, name: "A" }] });

    expect(store.sortedTags.map((t) => t.name)).toEqual(["A", "Z"]);
  });

  test("draftAndPublishedDocumentsUnassigned filters correctly", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, state: "Draft", assigned_to: null },
        { id: 2, state: "Published", assigned_to: null },
        { id: 3, state: "Progress", assigned_to: null },
        { id: 4, state: "Draft", assigned_to: 5 },
      ],
    });

    expect(store.draftAndPublishedDocumentsUnassigned.map((d) => d.id)).toEqual([1, 2]);
  });

  test("publishedDocumentsUnassigned filters only Published without assignment", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, state: "Published", assigned_to: null },
        { id: 2, state: "Published", assigned_to: 10 },
        { id: 3, state: "Draft", assigned_to: null },
      ],
    });

    expect(store.publishedDocumentsUnassigned.map((d) => d.id)).toEqual([1]);
  });

  test("progressDocumentsByClient filters Progress documents", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, state: "Progress" },
        { id: 2, state: "Completed" },
        { id: 3, state: "Progress" },
      ],
    });

    expect(store.progressDocumentsByClient.map((d) => d.id)).toEqual([1, 3]);
  });

  test("pendingSignatureDocuments, fullySignedDocuments and completedDocumentsByClient filter by state", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, state: "PendingSignatures" },
        { id: 2, state: "FullySigned" },
        { id: 3, state: "Completed" },
        { id: 4, state: "Draft" },
      ],
    });

    expect(store.pendingSignatureDocuments.map((d) => d.id)).toEqual([1]);
    expect(store.fullySignedDocuments.map((d) => d.id)).toEqual([2]);
    expect(store.completedDocumentsByClient.map((d) => d.id)).toEqual([3]);
  });

  test("progressAndCompletedDocumentsByClient matches assigned_to and state", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, state: "Progress", assigned_to: 10 },
        { id: 2, state: "Completed", assigned_to: 10 },
        { id: 3, state: "Draft", assigned_to: 10 },
        { id: 4, state: "Progress", assigned_to: 11 },
      ],
    });

    expect(store.progressAndCompletedDocumentsByClient(10).map((d) => d.id)).toEqual([1, 2]);
    expect(store.progressAndCompletedDocumentsByClient("10").map((d) => d.id)).toEqual([1, 2]);
    expect(store.progressAndCompletedDocumentsByClient(null)).toEqual([]);
  });

  test("progressAndCompletedDocumentsByClient ignores documents with no assigned_to", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, state: "Progress", assigned_to: null },
        { id: 2, state: "Completed" },
        { id: 3, state: "Progress", assigned_to: 20 },
      ],
    });

    expect(store.progressAndCompletedDocumentsByClient(20).map((d) => d.id)).toEqual([3]);
  });

  test("getDocumentsByLawyerId filters by created_by and Draft/Published", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, state: "Draft", created_by: 7 },
        { id: 2, state: "Published", created_by: 7 },
        { id: 3, state: "Progress", created_by: 7 },
        { id: 4, state: "Draft", created_by: 8 },
      ],
    });

    expect(store.getDocumentsByLawyerId(7).map((d) => d.id)).toEqual([1, 2]);
    expect(store.getDocumentsByLawyerId(null)).toEqual([]);
  });

  test("documentsByClient filters by client_id and returns [] when clientId is falsy", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, client_id: 10 },
        { id: 2, client_id: 11 },
        { id: 3, client_id: 10 },
      ],
    });

    expect(store.documentsByClient("10").map((d) => d.id)).toEqual([1, 3]);
    expect(store.documentsByClient(11).map((d) => d.id)).toEqual([2]);
    expect(store.documentsByClient(null)).toEqual([]);
  });

  test("filteredDocuments filters by query across title/state and assigned_to user fields", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, title: "Contrato", state: "Draft", assigned_to: 10 },
        { id: 2, title: "Minuta", state: "Published", assigned_to: null },
      ],
    });

    const userStore = {
      userById: (id) => (id === 10 ? { first_name: "Juan", last_name: "Perez", email: "jp@test.com", identification: "ABC" } : null),
    };

    expect(store.filteredDocuments("contr", userStore).map((d) => d.id)).toEqual([1]);
    expect(store.filteredDocuments("published", userStore).map((d) => d.id)).toEqual([2]);
    expect(store.filteredDocuments("juan", userStore).map((d) => d.id)).toEqual([1]);
  });

  test("filteredDocuments returns all when query is empty", () => {
    const store = useDynamicDocumentStore();

    store.$patch({ documents: [{ id: 1 }, { id: 2 }] });

    expect(store.filteredDocuments("", null).map((d) => d.id)).toEqual([1, 2]);
  });

  test("filteredDocuments ignores assigned_to when userStore is missing", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [{ id: 1, title: "Titulo", state: "Draft", assigned_to: 99 }],
    });

    expect(store.filteredDocuments("persona", null)).toEqual([]);
  });

  test("filteredDocumentsByTags filters documents by selected tag ids", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, title: "A", state: "Draft", tags: [{ id: 5 }] },
        { id: 2, title: "B", state: "Draft", tags: [{ id: 6 }] },
        { id: 3, title: "C", state: "Draft", tags: [] },
      ],
    });

    expect(store.filteredDocumentsByTags([5]).map((d) => d.id)).toEqual([1]);
    expect(store.filteredDocumentsByTags([]).map((d) => d.id)).toEqual([1, 2, 3]);
  });

  test("filteredDocumentsByTags excludes documents with no tags", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, title: "A", tags: [] },
        { id: 2, title: "B" },
        { id: 3, title: "C", tags: [{ id: 5 }] },
      ],
    });

    expect(store.filteredDocumentsByTags([5]).map((d) => d.id)).toEqual([3]);
  });

  test("filteredDocumentsBySearchAndTags applies search first then tags", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, title: "Contrato A", state: "Draft", assigned_to: null, tags: [{ id: 5 }] },
        { id: 2, title: "Contrato B", state: "Draft", assigned_to: null, tags: [{ id: 6 }] },
        { id: 3, title: "Otro", state: "Draft", assigned_to: null, tags: [{ id: 5 }] },
      ],
    });

    const userStore = { userById: () => null };

    const result = store.filteredDocumentsBySearchAndTags("contrato", userStore, [5]);
    expect(result.map((d) => d.id)).toEqual([1]);
  });

  test("filteredDocumentsBySearchAndTags matches assigned user fields", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, title: "Doc", state: "Draft", assigned_to: 10, tags: [{ id: 5 }] },
        { id: 2, title: "Doc", state: "Draft", assigned_to: 11, tags: [{ id: 5 }] },
      ],
    });

    const userStore = {
      userById: (id) => {
        if (id === 10) {
          return { first_name: "Ana", last_name: "Perez", email: "ana@test.com", identification: "ABC" };
        }
        return { first_name: "Bob", last_name: "Diaz", email: "bob@test.com", identification: "XYZ" };
      },
    };

    expect(store.filteredDocumentsBySearchAndTags("perez", userStore, [5]).map((d) => d.id)).toEqual([1]);
    expect(store.filteredDocumentsBySearchAndTags("test.com", userStore, [5]).map((d) => d.id)).toEqual([1, 2]);
    expect(store.filteredDocumentsBySearchAndTags("abc", userStore, [5]).map((d) => d.id)).toEqual([1]);
  });

  test("filteredDocumentsBySearchAndTags excludes documents with no tags when tags are selected", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, title: "Doc", state: "Draft", assigned_to: 10, tags: [] },
        { id: 2, title: "Doc", state: "Draft", assigned_to: 10, tags: [{ id: 5 }] },
      ],
    });

    const userStore = { userById: () => ({ first_name: "Ana" }) };

    const result = store.filteredDocumentsBySearchAndTags("ana", userStore, [5]);
    expect(result.map((d) => d.id)).toEqual([2]);
  });

  test("filteredDocumentsBySearchAndTags applies tag filter when query is empty", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, title: "Contrato", state: "Draft", tags: [{ id: 5 }] },
        { id: 2, title: "Otro", state: "Draft", tags: [{ id: 6 }] },
      ],
    });

    const result = store.filteredDocumentsBySearchAndTags("", null, [6]);
    expect(result.map((d) => d.id)).toEqual([2]);
  });

  test("filteredDocumentsBySearchAndTags skips tag filter when tag list is empty", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, title: "Contrato", state: "Draft", tags: [] },
        { id: 2, title: "Otro", state: "Draft", tags: [{ id: 5 }] },
      ],
    });

    const result = store.filteredDocumentsBySearchAndTags("contrato", null, []);
    expect(result.map((d) => d.id)).toEqual([1]);
  });

  test("filteredDocumentsBySearchAndTags skips assigned_to search when userStore missing", () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [
        { id: 1, title: "Contrato", state: "Draft", assigned_to: 10, tags: [{ id: 5 }] },
        { id: 2, title: "Otro", state: "Draft", assigned_to: 10, tags: [{ id: 6 }] },
      ],
    });

    const result = store.filteredDocumentsBySearchAndTags("contrato", null, [5, 6]);
    expect(result.map((d) => d.id)).toEqual([1]);
  });
});
