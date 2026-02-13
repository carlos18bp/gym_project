import { setActivePinia, createPinia } from "pinia";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

const mock = new AxiosMockAdapter(axios);

function getQueryParams(url) {
  const queryString = (url || "").split("?")[1] || "";
  return new URLSearchParams(queryString);
}

describe("Dynamic Document Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
  });

  test("fetchDocuments uses default limit (10) and updates pagination", async () => {
    const store = useDynamicDocumentStore();

    const apiResponse = {
      items: [{ id: 1 }, { id: 2 }],
      totalItems: 2,
      totalPages: 1,
      currentPage: 1,
    };

    mock.onGet(/\/api\/dynamic-documents\/\?.*/).reply(200, apiResponse);

    await store.fetchDocuments();

    expect(store.documents).toEqual(apiResponse.items);
    expect(store.pagination.currentPage).toBe(1);
    expect(store.pagination.itemsPerPage).toBe(10);
    expect(store.pagination.totalItems).toBe(2);
    expect(store.pagination.totalPages).toBe(1);

    expect(mock.history.get).toHaveLength(1);
    const params = getQueryParams(mock.history.get[0].url);
    expect(params.get("page")).toBe("1");
    expect(params.get("limit")).toBe("10");
  });

  test("fetchDocuments sends states and lawyer_id filters", async () => {
    const store = useDynamicDocumentStore();

    const apiResponse = {
      items: [{ id: 10 }],
      totalItems: 1,
      totalPages: 3,
      currentPage: 2,
    };

    mock.onGet(/\/api\/dynamic-documents\/\?.*/).reply(200, apiResponse);

    await store.fetchDocuments({
      page: 2,
      states: ["Draft", "Published"],
      lawyerId: 99,
      forceRefresh: true,
    });

    expect(mock.history.get).toHaveLength(1);
    const params = getQueryParams(mock.history.get[0].url);

    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe("10");
    expect(params.get("states")).toBe("Draft,Published");
    expect(params.get("lawyer_id")).toBe("99");
  });

  test("fetchDocuments sends client_id filter and supports custom limit", async () => {
    const store = useDynamicDocumentStore();

    const apiResponse = {
      items: [{ id: 20 }, { id: 21 }, { id: 22 }],
      totalItems: 13,
      totalPages: 5,
      currentPage: 3,
    };

    mock.onGet(/\/api\/dynamic-documents\/\?.*/).reply(200, apiResponse);

    await store.fetchDocuments({
      page: 3,
      limit: 3,
      clientId: 7,
      forceRefresh: true,
    });

    expect(store.pagination.currentPage).toBe(3);
    expect(store.pagination.itemsPerPage).toBe(3);
    expect(store.pagination.totalItems).toBe(13);
    expect(store.pagination.totalPages).toBe(5);

    expect(mock.history.get).toHaveLength(1);
    const params = getQueryParams(mock.history.get[0].url);
    expect(params.get("page")).toBe("3");
    expect(params.get("limit")).toBe("3");
    expect(params.get("client_id")).toBe("7");
  });

  test("fetchDocuments returns early when isLoading is true", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({ isLoading: true });

    const result = await store.fetchDocuments({ forceRefresh: true });

    expect(result).toBeUndefined();
    expect(mock.history.get).toHaveLength(0);
  });

  test("fetchDocuments sends state filter when provided", async () => {
    const store = useDynamicDocumentStore();

    const apiResponse = {
      items: [{ id: 10 }],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
    };

    mock.onGet(/\/api\/dynamic-documents\/\?.*/).reply(200, apiResponse);

    await store.fetchDocuments({ state: "Draft", forceRefresh: true });

    const params = getQueryParams(mock.history.get[0].url);
    expect(params.get("state")).toBe("Draft");
  });

  test("fetchDocuments falls back to items length and totalPages 1 when totals are missing", async () => {
    const store = useDynamicDocumentStore();

    const apiResponse = {
      items: [{ id: 1 }, { id: 2 }],
    };

    mock.onGet(/\/api\/dynamic-documents\/\?.*/).reply(200, apiResponse);

    await store.fetchDocuments({ forceRefresh: true });

    expect(store.pagination.totalItems).toBe(2);
    expect(store.pagination.totalPages).toBe(1);
  });

  test("fetchDocuments defaults documents to [] when response items is null", async () => {
    const store = useDynamicDocumentStore();

    const apiResponse = {
      items: null,
      totalItems: 1,
      totalPages: 0,
    };

    mock.onGet(/\/api\/dynamic-documents\/\?.*/).reply(200, apiResponse);

    await store.fetchDocuments({ forceRefresh: true });

    expect(store.documents).toEqual([]);
    expect(store.pagination.totalPages).toBe(1);
  });

  test("fetchDocuments does not refetch when recently loaded unless forceRefresh is true", async () => {
    const store = useDynamicDocumentStore();

    const apiResponse = {
      items: [{ id: 1 }],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
    };

    mock.onGet(/\/api\/dynamic-documents\/\?.*/).reply(200, apiResponse);

    const nowSpy = jest.spyOn(Date, "now");

    nowSpy.mockReturnValue(1000);
    await store.fetchDocuments();
    expect(mock.history.get).toHaveLength(1);

    nowSpy.mockReturnValue(2000);
    await store.fetchDocuments();
    expect(mock.history.get).toHaveLength(1);

    nowSpy.mockReturnValue(3000);
    await store.fetchDocuments({ forceRefresh: true });
    expect(mock.history.get).toHaveLength(2);

    nowSpy.mockRestore();
  });

  test("fetchDocuments normalizes legacy array response format", async () => {
    const store = useDynamicDocumentStore();

    mock.onGet(/\/api\/dynamic-documents\/\?.*/).reply(200, [{ id: 1 }, { id: 2 }]);

    await store.fetchDocuments({ forceRefresh: true });

    expect(store.documents).toEqual([{ id: 1 }, { id: 2 }]);
    expect(store.pagination.totalItems).toBe(2);
    expect(store.pagination.totalPages).toBe(1);
  });

  test("fetchDocuments appends items when append is true and page > 1", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({ documents: [{ id: 1 }] });

    mock.onGet(/\/api\/dynamic-documents\/\?.*/).replyOnce(200, {
      items: [{ id: 2 }],
      totalItems: 2,
      totalPages: 2,
      currentPage: 2,
    });

    await store.fetchDocuments({ page: 2, append: true, forceRefresh: true });

    expect(store.documents).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test("fetchDocuments clears documents on error when page is 1", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    store.$patch({ documents: [{ id: 1 }], dataLoaded: false });

    mock.onGet(/\/api\/dynamic-documents\/\?.*/).reply(500, { detail: "error" });

    await expect(store.fetchDocuments({ page: 1, forceRefresh: true })).rejects.toBeTruthy();
    expect(store.documents).toEqual([]);

    consoleSpy.mockRestore();
  });

  test("fetchDocuments keeps existing documents on error when page > 1", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    store.$patch({ documents: [{ id: 1 }], dataLoaded: false });

    mock.onGet(/\/api\/dynamic-documents\/\?.*/).reply(500, { detail: "error" });

    await expect(store.fetchDocuments({ page: 2, forceRefresh: true })).rejects.toBeTruthy();
    expect(store.documents).toEqual([{ id: 1 }]);

    consoleSpy.mockRestore();
  });
});
