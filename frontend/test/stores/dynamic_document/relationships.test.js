import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { documentRelationshipsActions } from "@/stores/dynamic_document/relationships";
import * as requestHttp from "@/stores/services/request_http";

const mock = new AxiosMockAdapter(axios);

describe("Dynamic Document - Relationships actions", () => {
  beforeEach(() => {
    mock.reset();
  });

  test("getDocumentRelationships returns response data (or empty array)", async () => {
    mock.onGet("/api/dynamic-documents/10/relationships/").reply(200, [{ id: 1 }]);

    const result = await documentRelationshipsActions.getDocumentRelationships(10);

    expect(result).toEqual([{ id: 1 }]);

    mock.onGet("/api/dynamic-documents/11/relationships/").reply(200, null);

    const resultEmpty = await documentRelationshipsActions.getDocumentRelationships(11);
    expect(resultEmpty).toEqual([]);
  });

  test("getDocumentRelationships throws on error", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/dynamic-documents/12/relationships/").reply(500, { detail: "error" });

    await expect(documentRelationshipsActions.getDocumentRelationships(12)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("getRelatedDocuments returns response data (or empty array)", async () => {
    mock.onGet("/api/dynamic-documents/10/related-documents/").reply(200, [{ id: 2 }]);

    const result = await documentRelationshipsActions.getRelatedDocuments(10);

    expect(result).toEqual([{ id: 2 }]);

    mock.onGet("/api/dynamic-documents/11/related-documents/").reply(200, undefined);

    const resultEmpty = await documentRelationshipsActions.getRelatedDocuments(11);
    expect(resultEmpty).toEqual([]);
  });

  test("getRelatedDocuments throws on error", async () => {
    mock.onGet("/api/dynamic-documents/13/related-documents/").reply(500, { detail: "error" });

    await expect(documentRelationshipsActions.getRelatedDocuments(13)).rejects.toBeTruthy();
  });

  test("getAvailableDocumentsForRelationship returns response data (or empty array)", async () => {
    mock
      .onGet("/api/dynamic-documents/10/available-for-relationship/")
      .reply(200, [{ id: 3 }]);

    const result = await documentRelationshipsActions.getAvailableDocumentsForRelationship(10);

    expect(result).toEqual([{ id: 3 }]);

    mock
      .onGet("/api/dynamic-documents/11/available-for-relationship/")
      .reply(200, null);

    const resultEmpty = await documentRelationshipsActions.getAvailableDocumentsForRelationship(11);
    expect(resultEmpty).toEqual([]);
  });

  test("getAvailableDocumentsForRelationship appends allow_pending_signatures query", async () => {
    mock
      .onGet(
        "/api/dynamic-documents/12/available-for-relationship/?allow_pending_signatures=true"
      )
      .reply(200, [{ id: 4 }]);

    const result = await documentRelationshipsActions.getAvailableDocumentsForRelationship(12, {
      allowPendingSignatures: true,
    });

    expect(result).toEqual([{ id: 4 }]);
  });

  test("getAvailableDocumentsForRelationship throws on error", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock
      .onGet("/api/dynamic-documents/10/available-for-relationship/")
      .reply(500, { detail: "error" });

    await expect(
      documentRelationshipsActions.getAvailableDocumentsForRelationship(10)
    ).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("createDocumentRelationship creates relationship and registers activity", async () => {
    const rel = {
      id: 1,
      source_document: 10,
      target_document: 20,
      source_document_title: "Source",
      target_document_title: "Target",
    };

    mock
      .onPost("/api/dynamic-documents/relationships/create/")
      .reply(201, rel);
    mock.onPost("/api/create-activity/").reply(200, { id: 99 });

    const result = await documentRelationshipsActions.createDocumentRelationship({
      source_document: 10,
      target_document: 20,
    });

    expect(result).toEqual(rel);

    expect(mock.history.post).toHaveLength(2);
    expect(mock.history.post[0].url).toBe("/api/dynamic-documents/relationships/create/");
    expect(mock.history.post[1].url).toBe("/api/create-activity/");
  });

  test("createDocumentRelationship still resolves even if activity registration fails", async () => {
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const rel = {
      id: 1,
      source_document: 10,
      target_document: 20,
      source_document_title: "Source",
      target_document_title: "Target",
    };

    mock
      .onPost("/api/dynamic-documents/relationships/create/")
      .reply(201, rel);
    mock.onPost("/api/create-activity/").reply(500, { detail: "error" });

    const result = await documentRelationshipsActions.createDocumentRelationship({
      source_document: 10,
      target_document: 20,
    });

    expect(result).toEqual(rel);

    expect(mock.history.post).toHaveLength(2);

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("createDocumentRelationship uses fallback titles when response omits titles", async () => {
    const rel = {
      id: 2,
      source_document: 30,
      target_document: 40,
    };

    mock
      .onPost("/api/dynamic-documents/relationships/create/")
      .reply(201, rel);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await documentRelationshipsActions.createDocumentRelationship({
      source_document: 30,
      target_document: 40,
    });

    expect(result).toEqual(rel);

    const activityPayload = JSON.parse(mock.history.post[1].data);
    expect(activityPayload.description).toContain('documento origen');
    expect(activityPayload.description).toContain('documento relacionado');
  });

  test("createDocumentRelationship throws when create endpoint fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock
      .onPost("/api/dynamic-documents/relationships/create/")
      .reply(500, { detail: "error" });

    await expect(
      documentRelationshipsActions.createDocumentRelationship({
        source_document: 10,
        target_document: 20,
      })
    ).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("deleteDocumentRelationship returns true for 200 and registers activity", async () => {
    mock
      .onDelete("/api/dynamic-documents/relationships/5/delete/")
      .reply(200, { ok: true });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await documentRelationshipsActions.deleteDocumentRelationship(5);

    expect(result).toBe(true);
    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.post).toHaveLength(1);
  });

  test("deleteDocumentRelationship returns false for non-success status", async () => {
    const spy = jest
      .spyOn(requestHttp, "delete_request")
      .mockResolvedValue({ status: 400, data: { detail: "bad" } });

    const result = await documentRelationshipsActions.deleteDocumentRelationship(9);

    expect(result).toBe(false);

    spy.mockRestore();
  });

  test("deleteDocumentRelationship returns true for 204 and registers activity", async () => {
    mock
      .onDelete("/api/dynamic-documents/relationships/6/delete/")
      .reply(204);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await documentRelationshipsActions.deleteDocumentRelationship(6);

    expect(result).toBe(true);
    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.post).toHaveLength(1);
  });

  test("deleteDocumentRelationship still resolves true even if activity registration fails", async () => {
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock
      .onDelete("/api/dynamic-documents/relationships/7/delete/")
      .reply(204);
    mock.onPost("/api/create-activity/").reply(500, { detail: "error" });

    const result = await documentRelationshipsActions.deleteDocumentRelationship(7);

    expect(result).toBe(true);

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("deleteDocumentRelationship throws on request error", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock
      .onDelete("/api/dynamic-documents/relationships/8/delete/")
      .networkError();

    await expect(
      documentRelationshipsActions.deleteDocumentRelationship(8)
    ).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });
});
