import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useRecentDocumentStore } from "@/stores/dashboard/recentDocument";

const mock = new AxiosMockAdapter(axios);

describe("Recent Document Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  test("fetchRecentDocuments loads recent documents", async () => {
    const store = useRecentDocumentStore();

    mock.onGet("/api/dynamic-documents/recent/").reply(200, [{ id: 1 }]);

    await store.fetchRecentDocuments();

    expect(store.recentDocuments).toEqual([{ id: 1 }]);
  });

  test("fetchRecentDocuments logs error on failure", async () => {
    const store = useRecentDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/dynamic-documents/recent/").reply(500, { detail: "error" });

    await store.fetchRecentDocuments();

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("updateRecentDocument calls update endpoint and refreshes recent documents", async () => {
    const store = useRecentDocumentStore();

    mock.onPost("/api/dynamic-documents/5/update-recent/").reply(200, { ok: true });
    mock.onGet("/api/dynamic-documents/recent/").reply(200, [{ id: 5 }]);

    await store.updateRecentDocument(5);

    expect(store.recentDocuments).toEqual([{ id: 5 }]);
  });

  test("updateRecentDocument handles errors without throwing", async () => {
    const store = useRecentDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/dynamic-documents/5/update-recent/").reply(500, { detail: "error" });

    await store.updateRecentDocument(5);

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
