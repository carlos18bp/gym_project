import { setActivePinia, createPinia } from "pinia";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

jest.mock("@/shared/document_utils", () => ({
  __esModule: true,
  downloadFile: jest.fn(),
}));

import { downloadFile } from "@/shared/document_utils";
import * as requestHttp from "@/stores/services/request_http";

const mock = new AxiosMockAdapter(axios);

describe("Dynamic Document Store - documents module behaviors", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    localStorage.clear();
    document.cookie = "";
    jest.clearAllMocks();
  });

  test("fetchDocumentById returns cached document when available and not forcing refresh", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documentCache: {
        5: { id: 5, title: "Cached" },
      },
    });

    const result = await store.fetchDocumentById(5);

    expect(result).toEqual({ id: 5, title: "Cached" });
    expect(mock.history.get).toHaveLength(0);
  });

  test("fetchDocumentById fetches, caches, and updates main list when document exists", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [{ id: 7, title: "Old" }],
    });

    mock.onGet("/api/dynamic-documents/7/").reply(200, { id: 7, title: "New" });

    const result = await store.fetchDocumentById(7);

    expect(result).toEqual({ id: 7, title: "New" });
    expect(store.documentCache[7]).toEqual({ id: 7, title: "New" });
    expect(store.documents.find((d) => d.id === 7)).toEqual({ id: 7, title: "New" });
    expect(mock.history.get).toHaveLength(1);
  });

  test("fetchDocumentById does not update list when document is missing", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [{ id: 1, title: "Keep" }],
    });

    mock.onGet("/api/dynamic-documents/8/").reply(200, { id: 8, title: "New" });

    const result = await store.fetchDocumentById(8);

    expect(result).toEqual({ id: 8, title: "New" });
    expect(store.documentCache[8]).toEqual({ id: 8, title: "New" });
    expect(store.documents).toEqual([{ id: 1, title: "Keep" }]);
  });

  test("fetchDocumentById logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/dynamic-documents/99/").reply(500, { detail: "err" });

    await expect(store.fetchDocumentById(99)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("getDocumentLetterheadWordTemplate returns response on 200", async () => {
    const store = useDynamicDocumentStore();

    document.cookie = "csrftoken=abc";

    mock
      .onGet("/api/dynamic-documents/12/letterhead/word-template/")
      .reply(200, { ok: true });

    const result = await store.getDocumentLetterheadWordTemplate(12);

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ ok: true });
  });

  test("createDocument forces Progress for client docs without requires_signature when state is unexpected", async () => {
    const store = useDynamicDocumentStore();

    const tagData = {
      title: "Doc",
      state: "Unexpected",
      assigned_to: 123,
      requires_signature: false,
    };

    mock.onPost("/api/dynamic-documents/create/").reply((config) => {
      const payload = JSON.parse(config.data);
      return [201, { id: 1, ...payload }];
    });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.createDocument({ ...tagData });

    expect(result.id).toBe(1);
    expect(store.documents[0].id).toBe(1);
    expect(store.lastUpdatedDocumentId).toBe(1);
    expect(localStorage.getItem("lastUpdatedDocumentId")).toBe("1");

    expect(mock.history.post).toHaveLength(2);
    const createPayload = JSON.parse(mock.history.post[0].data);
    expect(createPayload.state).toBe("Progress");
  });

  test("createDocument does not override state when requires_signature is true", async () => {
    const store = useDynamicDocumentStore();

    const docData = {
      title: "Doc",
      state: "Unexpected",
      assigned_to: 123,
      requires_signature: true,
    };

    mock.onPost("/api/dynamic-documents/create/").reply((config) => {
      const payload = JSON.parse(config.data);
      return [201, { id: 2, ...payload }];
    });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.createDocument({ ...docData });

    expect(result.id).toBe(2);
    const createPayload = JSON.parse(mock.history.post[0].data);
    expect(createPayload.state).toBe("Unexpected");
  });

  test("createDocument uses fallback title in activity when title is missing", async () => {
    const store = useDynamicDocumentStore();

    const docData = {
      title: "",
      state: "Draft",
    };

    mock.onPost("/api/dynamic-documents/create/").reply((config) => {
      const payload = JSON.parse(config.data);
      return [201, { id: 3, ...payload }];
    });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.createDocument({ ...docData });

    expect(result.id).toBe(3);
    const activityPayload = JSON.parse(mock.history.post[1].data);
    expect(activityPayload.description).toContain("sin título");
  });

  test("createDocument logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/dynamic-documents/create/").reply(500, { detail: "err" });

    await expect(store.createDocument({ title: "Doc" })).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("updateDocument updates cache and list, sets lastUpdatedDocumentId and registers activity", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [{ id: 2, title: "Old" }],
      documentCache: {},
    });

    mock.onPut("/api/dynamic-documents/2/update/").reply(200, { id: 2, title: "Updated" });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.updateDocument(2, { title: "Updated" });

    expect(result).toEqual({ id: 2, title: "Updated" });
    expect(store.documentCache[2]).toEqual({ id: 2, title: "Updated" });
    expect(store.documents.find((d) => d.id === 2)).toEqual({ id: 2, title: "Updated" });
    expect(store.lastUpdatedDocumentId).toBe(2);
    expect(localStorage.getItem("lastUpdatedDocumentId")).toBe("2");

    expect(mock.history.put).toHaveLength(1);
    expect(mock.history.post).toHaveLength(1);
  });

  test("updateDocument uses fallback title and leaves list untouched when missing", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [{ id: 1, title: "Keep" }],
      documentCache: {},
    });

    mock.onPut("/api/dynamic-documents/8/update/").reply(200, { id: 8, title: "Updated" });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.updateDocument(8, { title: "" });

    expect(result).toEqual({ id: 8, title: "Updated" });
    expect(store.documentCache[8]).toEqual({ id: 8, title: "Updated" });
    expect(store.documents).toEqual([{ id: 1, title: "Keep" }]);

    const activityPayload = JSON.parse(mock.history.post[mock.history.post.length - 1].data);
    expect(activityPayload.description).toContain("sin título");
  });

  test("updateDocument logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/dynamic-documents/2/update/").reply(500, { detail: "err" });

    await expect(store.updateDocument(2, { title: "Updated" })).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("deleteDocument removes from cache and list and returns true for 200", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      documents: [{ id: 3, title: "ToDelete" }],
      documentCache: { 3: { id: 3, title: "ToDelete" } },
    });

    mock.onDelete("/api/dynamic-documents/3/delete/").reply(200);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.deleteDocument(3);

    expect(result).toBe(true);
    expect(store.documents).toEqual([]);
    expect(store.documentCache[3]).toBeUndefined();
  });

  test("deleteDocument returns false on request error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    store.$patch({ documents: [{ id: 4, title: "X" }] });

    mock.onDelete("/api/dynamic-documents/4/delete/").networkError();

    const result = await store.deleteDocument(4);

    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });

  test("deleteDocument returns false on non-2xx response", async () => {
    const store = useDynamicDocumentStore();

    const spy = jest.spyOn(requestHttp, "delete_request").mockResolvedValue({ status: 400 });

    const result = await store.deleteDocument(6);

    expect(result).toBe(false);

    spy.mockRestore();
  });

  test("loadMoreDocuments calls fetchDocuments with next page and append", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      pagination: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 20,
        totalPages: 2,
        hasMore: true,
      },
      isLoading: false,
    });

    const fetchSpy = jest
      .spyOn(store, "fetchDocuments")
      .mockResolvedValue({ currentPage: 2, hasMore: false });

    await store.loadMoreDocuments({ states: ["Draft"] });

    expect(fetchSpy).toHaveBeenCalledWith({ states: ["Draft"], page: 2, append: true });
  });

  test("downloadPDF calls downloadFile and registers activity", async () => {
    const store = useDynamicDocumentStore();

    downloadFile.mockResolvedValue();
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    await store.downloadPDF(10, "MyDoc");

    expect(downloadFile).toHaveBeenCalledWith(
      "dynamic-documents/10/download-pdf/",
      "MyDoc.pdf"
    );
    expect(mock.history.post).toHaveLength(1);
  });

  test("downloadPDF logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    downloadFile.mockRejectedValueOnce(new Error("fail"));

    await expect(store.downloadPDF(10, "MyDoc")).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("downloadWord calls downloadFile and registers activity", async () => {
    const store = useDynamicDocumentStore();

    downloadFile.mockResolvedValue();
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    await store.downloadWord(11, "MyDoc");

    expect(downloadFile).toHaveBeenCalledWith(
      "dynamic-documents/11/download-word/",
      "MyDoc.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(mock.history.post).toHaveLength(1);
  });

  test("downloadWord logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    downloadFile.mockRejectedValueOnce(new Error("fail"));

    await expect(store.downloadWord(11, "MyDoc")).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("getLetterheadImage returns null on 404", async () => {
    const store = useDynamicDocumentStore();

    document.cookie = "csrftoken=abc";
    localStorage.setItem("token", "tkn");

    mock.onGet("/api/dynamic-documents/9/letterhead/").reply(404);

    const result = await store.getLetterheadImage(9);

    expect(result).toBe(null);
    expect(mock.history.get).toHaveLength(1);
  });

  test("getLetterheadImage returns response on 200", async () => {
    const store = useDynamicDocumentStore();

    document.cookie = "csrftoken=abc";

    mock.onGet("/api/dynamic-documents/9/letterhead/").reply(200, new Blob(["img"]));

    const result = await store.getLetterheadImage(9);

    expect(result.status).toBe(200);
  });

  test("getGlobalLetterheadImage logs and throws on non-404 errors", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/user/letterhead/").reply(500, { detail: "err" });

    await expect(store.getGlobalLetterheadImage()).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("getLetterheadImage logs and throws on non-404 error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/dynamic-documents/9/letterhead/").reply(500, { detail: "err" });

    await expect(store.getLetterheadImage(9)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("getGlobalLetterheadWordTemplate returns null on 404", async () => {
    const store = useDynamicDocumentStore();

    document.cookie = "csrftoken=abc";

    mock.onGet("/api/user/letterhead/word-template/").reply(404);

    const result = await store.getGlobalLetterheadWordTemplate();

    expect(result).toBe(null);
  });

  test("getGlobalLetterheadWordTemplate omits Authorization header when token missing", async () => {
    const store = useDynamicDocumentStore();

    document.cookie = "csrftoken=abc";
    localStorage.removeItem("token");
    let capturedHeaders = {};

    mock.onGet("/api/user/letterhead/word-template/").reply((config) => {
      capturedHeaders = config.headers || {};
      return [404];
    });

    const result = await store.getGlobalLetterheadWordTemplate();

    expect(result).toBe(null);
    const headerKeys = Object.keys(capturedHeaders || {}).map((k) => k.toLowerCase());
    expect(headerKeys).not.toContain("authorization");
  });

  test("getGlobalLetterheadWordTemplate includes Authorization header when token exists", async () => {
    const store = useDynamicDocumentStore();

    document.cookie = "csrftoken=abc";
    localStorage.setItem("token", "token-123");
    let capturedHeaders = {};

    mock.onGet("/api/user/letterhead/word-template/").reply((config) => {
      capturedHeaders = config.headers || {};
      return [404];
    });

    const result = await store.getGlobalLetterheadWordTemplate();

    expect(result).toBe(null);
    expect(capturedHeaders.Authorization).toBe("Bearer token-123");
  });

  test("getGlobalLetterheadWordTemplate returns response on 200", async () => {
    const store = useDynamicDocumentStore();

    document.cookie = "csrftoken=abc";

    mock.onGet("/api/user/letterhead/word-template/").reply(200, { ok: true });

    const result = await store.getGlobalLetterheadWordTemplate();

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ ok: true });
  });

  test("getGlobalLetterheadWordTemplate logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/user/letterhead/word-template/").reply(500, { detail: "err" });

    await expect(store.getGlobalLetterheadWordTemplate()).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("getDocumentLetterheadWordTemplate logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/dynamic-documents/12/letterhead/word-template/").reply(500, { detail: "err" });

    await expect(store.getDocumentLetterheadWordTemplate(12)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("clearSelectedDocument sets selectedDocument to null", () => {
    const store = useDynamicDocumentStore();

    store.$patch({ selectedDocument: { id: 1 } });

    store.clearSelectedDocument();

    expect(store.selectedDocument).toBe(null);
  });

  test("loadMoreDocuments does nothing when hasMore is false", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      pagination: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 0,
        totalPages: 1,
        hasMore: false,
      },
      isLoading: false,
    });

    const fetchSpy = jest.spyOn(store, "fetchDocuments");

    const result = await store.loadMoreDocuments();

    expect(result).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("loadMoreDocuments does nothing when isLoading is true", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({
      pagination: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 20,
        totalPages: 2,
        hasMore: true,
      },
      isLoading: true,
    });

    const fetchSpy = jest.spyOn(store, "fetchDocuments");

    const result = await store.loadMoreDocuments();

    expect(result).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("uploadLetterheadImage posts FormData and registers activity", async () => {
    const store = useDynamicDocumentStore();

    const image = new Blob(["x"], { type: "image/png" });

    mock.onPost("/api/dynamic-documents/9/letterhead/upload/").reply(200, { ok: true });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.uploadLetterheadImage(9, image);

    expect(result.status).toBe(200);
    expect(mock.history.post).toHaveLength(2);
    expect(mock.history.post[0].url).toBe("/api/dynamic-documents/9/letterhead/upload/");
    expect(mock.history.post[1].url).toBe("/api/create-activity/");
  });

  test("uploadLetterheadImage logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const image = new Blob(["x"], { type: "image/png" });

    mock.onPost("/api/dynamic-documents/9/letterhead/upload/").reply(500, { detail: "err" });

    await expect(store.uploadLetterheadImage(9, image)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("deleteLetterheadImage calls delete endpoint and registers activity", async () => {
    const store = useDynamicDocumentStore();

    mock.onDelete("/api/dynamic-documents/9/letterhead/delete/").reply(204);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.deleteLetterheadImage(9);

    expect(result.status).toBe(204);
    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.post).toHaveLength(1);
  });

  test("init defaults forceRefresh to false", async () => {
    const store = useDynamicDocumentStore();

    const fetchSpy = jest.spyOn(store, "fetchDocuments").mockResolvedValue({});

    await store.init();

    expect(fetchSpy).toHaveBeenCalledWith({ forceRefresh: false });
  });

  test("deleteDocumentLetterheadWordTemplate logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onDelete("/api/dynamic-documents/12/letterhead/word-template/delete/").reply(500, { detail: "err" });

    await expect(store.deleteDocumentLetterheadWordTemplate(12)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("deleteGlobalLetterheadImage logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onDelete("/api/user/letterhead/delete/").reply(500, { detail: "err" });

    await expect(store.deleteGlobalLetterheadImage()).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("deleteLetterheadImage logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onDelete("/api/dynamic-documents/9/letterhead/delete/").reply(500, { detail: "err" });

    await expect(store.deleteLetterheadImage(9)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("uploadGlobalLetterheadImage posts FormData and registers activity", async () => {
    const store = useDynamicDocumentStore();

    const image = new Blob(["x"], { type: "image/png" });

    mock.onPost("/api/user/letterhead/upload/").reply(200, { ok: true });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.uploadGlobalLetterheadImage(image);

    expect(result.status).toBe(200);
    expect(mock.history.post).toHaveLength(2);
    expect(mock.history.post[0].url).toBe("/api/user/letterhead/upload/");
    expect(mock.history.post[1].url).toBe("/api/create-activity/");
  });

  test("uploadGlobalLetterheadImage logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const image = new Blob(["x"], { type: "image/png" });

    mock.onPost("/api/user/letterhead/upload/").reply(500, { detail: "err" });

    await expect(store.uploadGlobalLetterheadImage(image)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("getGlobalLetterheadImage returns response when configured", async () => {
    const store = useDynamicDocumentStore();

    mock.onGet("/api/user/letterhead/").reply(200, new Blob(["img"]));

    const result = await store.getGlobalLetterheadImage();

    expect(result.status).toBe(200);
  });

  test("getGlobalLetterheadImage throws on 404 but does not log an error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/user/letterhead/").reply(404);

    await expect(store.getGlobalLetterheadImage()).rejects.toBeTruthy();

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("deleteGlobalLetterheadImage deletes and registers activity", async () => {
    const store = useDynamicDocumentStore();

    mock.onDelete("/api/user/letterhead/delete/").reply(204);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.deleteGlobalLetterheadImage();

    expect(result.status).toBe(204);
    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.post).toHaveLength(1);
  });

  test("uploadGlobalLetterheadWordTemplate posts and registers activity", async () => {
    const store = useDynamicDocumentStore();

    const docx = new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    mock.onPost("/api/user/letterhead/word-template/upload/").reply(200, { ok: true });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.uploadGlobalLetterheadWordTemplate(docx);

    expect(result.status).toBe(200);
    expect(mock.history.post).toHaveLength(2);
  });

  test("uploadDocumentLetterheadWordTemplate logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const docx = new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    mock.onPost("/api/dynamic-documents/12/letterhead/word-template/upload/").reply(500, { detail: "err" });

    await expect(store.uploadDocumentLetterheadWordTemplate(12, docx)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("uploadGlobalLetterheadWordTemplate logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const docx = new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    mock.onPost("/api/user/letterhead/word-template/upload/").reply(500, { detail: "err" });

    await expect(store.uploadGlobalLetterheadWordTemplate(docx)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("deleteGlobalLetterheadWordTemplate deletes and registers activity", async () => {
    const store = useDynamicDocumentStore();

    mock.onDelete("/api/user/letterhead/word-template/delete/").reply(204);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.deleteGlobalLetterheadWordTemplate();

    expect(result.status).toBe(204);
  });

  test("deleteGlobalLetterheadWordTemplate logs and throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onDelete("/api/user/letterhead/word-template/delete/").reply(500, { detail: "err" });

    await expect(store.deleteGlobalLetterheadWordTemplate()).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("getDocumentLetterheadWordTemplate returns null on 404", async () => {
    const store = useDynamicDocumentStore();

    document.cookie = "csrftoken=abc";
    localStorage.setItem("token", "tkn");

    mock.onGet("/api/dynamic-documents/12/letterhead/word-template/").reply(404);

    const result = await store.getDocumentLetterheadWordTemplate(12);

    expect(result).toBe(null);
  });

  test("uploadDocumentLetterheadWordTemplate posts and registers activity", async () => {
    const store = useDynamicDocumentStore();

    const docx = new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    mock.onPost("/api/dynamic-documents/12/letterhead/word-template/upload/").reply(200, { ok: true });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.uploadDocumentLetterheadWordTemplate(12, docx);

    expect(result.status).toBe(200);
    expect(mock.history.post).toHaveLength(2);
  });

  test("deleteDocumentLetterheadWordTemplate deletes and registers activity", async () => {
    const store = useDynamicDocumentStore();

    mock.onDelete("/api/dynamic-documents/12/letterhead/word-template/delete/").reply(204);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.deleteDocumentLetterheadWordTemplate(12);

    expect(result.status).toBe(204);
    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.post).toHaveLength(1);
  });

  test("init fetches documents when data is not loaded and reads lastUpdatedDocumentId from localStorage", async () => {
    const store = useDynamicDocumentStore();

    localStorage.setItem("lastUpdatedDocumentId", "55");

    const fetchSpy = jest.spyOn(store, "fetchDocuments").mockResolvedValue({});

    await store.init(false);

    expect(fetchSpy).toHaveBeenCalledWith({ forceRefresh: false });
    expect(store.lastUpdatedDocumentId).toBe(55);
  });

  test("init does not fetch when data is fresh and loaded", async () => {
    const store = useDynamicDocumentStore();

    const nowSpy = jest.spyOn(Date, "now");
    nowSpy.mockReturnValue(1000 * 60);

    store.$patch({ dataLoaded: true, lastFetchTime: 1000 * 60 });

    const fetchSpy = jest.spyOn(store, "fetchDocuments");

    await store.init(false);

    expect(fetchSpy).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  // ── fetchDocumentsForTab behavioral scenarios (lines 154-182) ──

  test("fetchDocumentsForTab returns paginated response when API returns items object", async () => {
    const store = useDynamicDocumentStore();

    const apiResponse = {
      items: [{ id: 1, title: "Doc1" }],
      totalItems: 1,
      totalPages: 1,
      currentPage: 1,
    };

    mock.onGet(/dynamic-documents\/\?/).reply(200, apiResponse);

    const result = await store.fetchDocumentsForTab({ page: 1, limit: 10 });

    expect(result).toEqual(apiResponse);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(1);
  });

  test("fetchDocumentsForTab wraps plain array response into paginated format", async () => {
    const store = useDynamicDocumentStore();

    const plainArray = [{ id: 2, title: "Doc2" }, { id: 3, title: "Doc3" }];

    mock.onGet(/dynamic-documents\/\?/).reply(200, plainArray);

    const result = await store.fetchDocumentsForTab();

    expect(result.items).toEqual(plainArray);
    expect(result.totalItems).toBe(2);
    expect(result.totalPages).toBe(1);
    expect(result.currentPage).toBe(1);
  });

  test("fetchDocumentsForTab sends state param when provided", async () => {
    const store = useDynamicDocumentStore();

    mock.onGet(/dynamic-documents\/\?/).reply(200, []);

    await store.fetchDocumentsForTab({ state: "Draft" });

    const url = mock.history.get[0].url;
    expect(url).toContain("state=Draft");
  });

  test("fetchDocumentsForTab sends states param as comma-separated list", async () => {
    const store = useDynamicDocumentStore();

    mock.onGet(/dynamic-documents\/\?/).reply(200, []);

    await store.fetchDocumentsForTab({ states: ["Draft", "Progress"] });

    const url = mock.history.get[0].url;
    expect(url).toContain("states=Draft%2CProgress");
  });

  test("fetchDocumentsForTab sends clientId and lawyerId params", async () => {
    const store = useDynamicDocumentStore();

    mock.onGet(/dynamic-documents\/\?/).reply(200, []);

    await store.fetchDocumentsForTab({ clientId: 5, lawyerId: 10 });

    const url = mock.history.get[0].url;
    expect(url).toContain("client_id=5");
    expect(url).toContain("lawyer_id=10");
  });

  test("fetchDocumentsForTab sends userRelated, signerSigned, and unassigned params", async () => {
    const store = useDynamicDocumentStore();

    mock.onGet(/dynamic-documents\/\?/).reply(200, []);

    await store.fetchDocumentsForTab({
      userRelated: true,
      signerSigned: true,
      unassigned: true,
    });

    const url = mock.history.get[0].url;
    expect(url).toContain("user_related=true");
    expect(url).toContain("signer_signed=true");
    expect(url).toContain("unassigned=true");
  });

  test("fetchDocumentsForTab does not send optional params when falsy", async () => {
    const store = useDynamicDocumentStore();

    mock.onGet(/dynamic-documents\/\?/).reply(200, []);

    await store.fetchDocumentsForTab({});

    const url = mock.history.get[0].url;
    const required = ["page=1", "limit=10"];
    const forbidden = [
      "state=",
      "states=",
      "client_id=",
      "lawyer_id=",
      "user_related=",
      "signer_signed=",
      "unassigned=",
    ];
    expect(required.every((segment) => url.includes(segment))).toBe(true);
    expect(forbidden.every((segment) => !url.includes(segment))).toBe(true);
  });

  test("fetchDocumentsForTab does not mutate store documents", async () => {
    const store = useDynamicDocumentStore();

    store.$patch({ documents: [{ id: 99, title: "Existing" }] });

    mock.onGet(/dynamic-documents\/\?/).reply(200, [{ id: 1, title: "Tab" }]);

    await store.fetchDocumentsForTab();

    expect(store.documents).toEqual([{ id: 99, title: "Existing" }]);
  });
});
