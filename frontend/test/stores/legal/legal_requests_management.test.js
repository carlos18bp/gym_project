import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useLegalRequestsStore } from "@/stores/legal/legal_requests_management";
import * as requestHttp from "@/stores/services/request_http";

const mock = new AxiosMockAdapter(axios);

describe("Legal Requests Management Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("getters filter requests", () => {
    const store = useLegalRequestsStore();

    store.$patch({
      requests: [
        { id: 1, status: "PENDING", response_count: 0 },
        { id: 2, status: "DONE", response_count: 2 },
      ],
    });

    expect(store.getRequestsByStatus("PENDING").map((r) => r.id)).toEqual([1]);
    expect(store.pendingRequestsCount).toBe(1);
    expect(store.requestsWithResponses.map((r) => r.id)).toEqual([2]);
  });

  test("fetchRequests sets requests and userRole", async () => {
    const store = useLegalRequestsStore();

    mock
      .onGet("/api/legal_requests/?search=x&status=PENDING&page=2")
      .reply(200, { requests: [{ id: 1 }], count: 1, user_role: "lawyer" });

    const result = await store.fetchRequests({ search: "x", status: "PENDING", page: 2 });

    expect(result.count).toBe(1);
    expect(store.requests).toEqual([{ id: 1 }]);
    expect(store.userRole).toBe("lawyer");
    expect(store.loading).toBe(false);
  });

  test("fetchRequests includes date range filters", async () => {
    const store = useLegalRequestsStore();

    const spy = jest.spyOn(requestHttp, "get_request").mockResolvedValue({
      status: 200,
      data: { requests: [], count: 0, user_role: "client" },
    });

    await store.fetchRequests({ date_from: "2024-01-01", date_to: "2024-02-01" });

    expect(spy).toHaveBeenCalledWith(
      "legal_requests/?date_from=2024-01-01&date_to=2024-02-01"
    );

    spy.mockRestore();
  });

  test("fetchRequests throws when status is not 200", async () => {
    const store = useLegalRequestsStore();

    mock.onGet("/api/legal_requests/").reply(204, { requests: [] });

    await expect(store.fetchRequests()).rejects.toThrow("Failed to fetch requests");
    expect(store.error).toBe("Failed to fetch requests");
    expect(store.loading).toBe(false);
  });

  test("fetchRequests sets error when request fails", async () => {
    const store = useLegalRequestsStore();

    mock.onGet("/api/legal_requests/").reply(500, { detail: "boom" });

    await expect(store.fetchRequests()).rejects.toBeTruthy();
    expect(store.error).toBeTruthy();
    expect(store.loading).toBe(false);
  });

  test("fetchRequests resets loading when get_request throws synchronously", async () => {
    const store = useLegalRequestsStore();

    const spy = jest
      .spyOn(requestHttp, "get_request")
      .mockImplementation(() => {
        throw new Error("sync");
      });

    await expect(store.fetchRequests()).rejects.toThrow("sync");
    expect(store.loading).toBe(false);

    spy.mockRestore();
  });

  test("fetchRequestDetail sets currentRequest", async () => {
    const store = useLegalRequestsStore();

    mock.onGet("/api/legal_requests/1/").reply(200, { id: 1, status: "PENDING" });

    const result = await store.fetchRequestDetail(1);

    expect(result.id).toBe(1);
    expect(store.currentRequest.id).toBe(1);
  });

  test("fetchRequestDetail throws when response is not 200", async () => {
    const store = useLegalRequestsStore();

    mock.onGet("/api/legal_requests/1/").reply(204, {});

    await expect(store.fetchRequestDetail(1)).rejects.toThrow("Failed to fetch request detail");
    expect(store.error).toBe("Failed to fetch request detail");
  });

  test("fetchRequestDetail resets loading when get_request throws synchronously", async () => {
    const store = useLegalRequestsStore();

    const spy = jest
      .spyOn(requestHttp, "get_request")
      .mockImplementation(() => {
        throw new Error("sync detail");
      });

    await expect(store.fetchRequestDetail(1)).rejects.toThrow("sync detail");
    expect(store.loading).toBe(false);

    spy.mockRestore();
  });

  test("updateRequestStatus updates list and currentRequest", async () => {
    const store = useLegalRequestsStore();

    store.$patch({
      requests: [{ id: 1, status: "PENDING", status_display: "Pendiente" }],
      currentRequest: { id: 1, status: "PENDING" },
    });

    mock.onPut("/api/legal_requests/1/status/").reply(200, {
      request: { id: 1, status: "DONE", status_display: "Finalizada" },
    });

    const result = await store.updateRequestStatus(1, "DONE");

    expect(result.status).toBe("DONE");
    expect(store.requests[0].status).toBe("DONE");
    expect(store.requests[0].status_display).toBe("Finalizada");
    expect(store.currentRequest.status).toBe("DONE");
  });

  test("updateRequestStatus skips updates when request is missing or currentRequest differs", async () => {
    const store = useLegalRequestsStore();

    store.$patch({
      requests: [{ id: 2, status: "PENDING", status_display: "Pendiente" }],
      currentRequest: { id: 2, status: "PENDING" },
    });

    mock.onPut("/api/legal_requests/1/status/").reply(200, {
      request: { id: 1, status: "DONE", status_display: "Finalizada" },
    });

    const result = await store.updateRequestStatus(1, "DONE");

    expect(result.id).toBe(1);
    expect(store.requests[0].status).toBe("PENDING");
    expect(store.currentRequest.id).toBe(2);
  });

  test("updateRequestStatus throws when backend returns non-200", async () => {
    const store = useLegalRequestsStore();

    mock.onPut("/api/legal_requests/1/status/").reply(400, { detail: "bad" });

    await expect(store.updateRequestStatus(1, "DONE")).rejects.toThrow("Request failed with status code 400");
  });

  test("updateRequestStatus throws when response status is not 200", async () => {
    const store = useLegalRequestsStore();

    const spy = jest.spyOn(requestHttp, "update_request").mockResolvedValue({ status: 204, data: {} });

    await expect(store.updateRequestStatus(1, "DONE")).rejects.toThrow("Failed to update request status");

    spy.mockRestore();
  });

  test("createResponse appends to currentRequest and increments response_count", async () => {
    const store = useLegalRequestsStore();

    store.$patch({
      requests: [{ id: 1, response_count: 0 }],
      currentRequest: { id: 1, responses: [] },
    });

    mock.onPost("/api/legal_requests/1/responses/").reply(201, { response: { id: 10, text: "hi" } });

    const result = await store.createResponse(1, "hi");

    expect(result.id).toBe(10);
    expect(store.currentRequest.responses).toHaveLength(1);
    expect(store.requests[0].response_count).toBe(1);
  });

  test("createResponse initializes responses array when missing", async () => {
    const store = useLegalRequestsStore();

    store.$patch({
      requests: [{ id: 1, response_count: 0 }],
      currentRequest: { id: 1 },
    });

    mock.onPost("/api/legal_requests/1/responses/").reply(201, { response: { id: 11, text: "hola" } });

    const result = await store.createResponse(1, "hola");

    expect(result.id).toBe(11);
    expect(store.currentRequest.responses).toHaveLength(1);
  });

  test("createResponse does not update state when request is missing", async () => {
    const store = useLegalRequestsStore();

    store.$patch({
      requests: [{ id: 2, response_count: 0 }],
      currentRequest: { id: 2, responses: [] },
    });

    mock.onPost("/api/legal_requests/1/responses/").reply(201, {
      response: { id: 22, text: "hi" },
    });

    const result = await store.createResponse(1, "hi");

    expect(result.id).toBe(22);
    expect(store.currentRequest.responses).toEqual([]);
    expect(store.requests[0].response_count).toBe(0);
  });

  test("createResponse throws when backend returns non-201", async () => {
    const store = useLegalRequestsStore();

    mock.onPost("/api/legal_requests/1/responses/").reply(200, {});

    await expect(store.createResponse(1, "x")).rejects.toThrow("Failed to create response");
  });

  test("deleteRequest removes request and clears currentRequest", async () => {
    const store = useLegalRequestsStore();

    store.$patch({
      requests: [{ id: 1 }, { id: 2 }],
      currentRequest: { id: 2 },
    });

    mock.onDelete("/api/legal_requests/2/delete/").reply(204);

    const result = await store.deleteRequest(2);

    expect(result).toBe(true);
    expect(store.requests.map((r) => r.id)).toEqual([1]);
    expect(store.currentRequest).toBe(null);
  });

  test("deleteRequest handles 200 response", async () => {
    const store = useLegalRequestsStore();

    store.$patch({ requests: [{ id: 1 }, { id: 2 }] });

    mock.onDelete("/api/legal_requests/1/delete/").reply(200);

    const result = await store.deleteRequest(1);

    expect(result).toBe(true);
    expect(store.requests.map((r) => r.id)).toEqual([2]);
  });

  test("deleteRequest throws when backend returns non-200/204 status", async () => {
    const store = useLegalRequestsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const spy = jest
      .spyOn(requestHttp, "delete_request")
      .mockResolvedValue({ status: 500, data: {} });

    await expect(store.deleteRequest(1)).rejects.toThrow(
      "Failed to delete request: Status 500"
    );

    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  test("deleteRequest throws a contextual error message when backend returns detail", async () => {
    const store = useLegalRequestsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onDelete("/api/legal_requests/2/delete/").reply(500, { detail: "fail" });

    await expect(store.deleteRequest(2)).rejects.toThrow("fail");

    consoleSpy.mockRestore();
  });

  test("deleteRequest prefers backend message when provided", async () => {
    const store = useLegalRequestsStore();

    mock.onDelete("/api/legal_requests/2/delete/").reply(500, { message: "boom" });

    await expect(store.deleteRequest(2)).rejects.toThrow("boom");
  });

  test("deleteRequest falls back to error.message when response missing", async () => {
    const store = useLegalRequestsStore();

    mock.onDelete("/api/legal_requests/2/delete/").networkError();

    await expect(store.deleteRequest(2)).rejects.toThrow(/Network Error/i);
  });

  test("deleteRequest falls back to default error when message is missing", async () => {
    const store = useLegalRequestsStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const spy = jest
      .spyOn(requestHttp, "delete_request")
      .mockRejectedValue({ response: { status: 500, data: {} } });

    await expect(store.deleteRequest(2)).rejects.toThrow(
      "Error desconocido al eliminar la solicitud"
    );

    spy.mockRestore();
    consoleSpy.mockRestore();
  });

  test("addFilesToRequest refreshes currentRequest when same request", async () => {
    const store = useLegalRequestsStore();

    store.$patch({ currentRequest: { id: 1 } });

    mock.onPost("/api/legal_requests/1/files/").reply(200, { message: "ok" });

    const detailSpy = jest.spyOn(store, "fetchRequestDetail").mockResolvedValue({ id: 1 });

    const res = await store.addFilesToRequest(1, [new File(["a"], "a.txt")]);

    expect(res.success).toBe(true);
    expect(detailSpy).toHaveBeenCalledWith(1);
  });

  test("addFilesToRequest skips refresh when currentRequest differs", async () => {
    const store = useLegalRequestsStore();

    store.$patch({ currentRequest: { id: 2 } });

    mock.onPost("/api/legal_requests/1/files/").reply(200, { message: "ok" });

    const detailSpy = jest.spyOn(store, "fetchRequestDetail").mockResolvedValue({ id: 1 });

    const res = await store.addFilesToRequest(1, [new File(["a"], "a.txt")]);

    expect(res.success).toBe(true);
    expect(detailSpy).not.toHaveBeenCalled();
  });

  test("addFilesToRequest throws when backend returns non-200", async () => {
    const store = useLegalRequestsStore();

    mock.onPost("/api/legal_requests/1/files/").reply(204, { message: "ok" });

    await expect(store.addFilesToRequest(1, [new File(["a"], "a.txt")])).rejects.toThrow("Failed to add files");
  });

  test("downloadFile uses axios directly and returns response on 200", async () => {
    const store = useLegalRequestsStore();

    localStorage.setItem("token", "tkn");

    mock.onGet("/api/legal_requests/1/files/2/download/").reply(200, new ArrayBuffer(10));

    const res = await store.downloadFile(1, 2);

    expect(res.status).toBe(200);
    expect(mock.history.get[0].url).toBe("/api/legal_requests/1/files/2/download/");
    expect(mock.history.get[0].headers.Authorization).toBe("Bearer tkn");
  });

  test("downloadFile omits Authorization when token is missing", async () => {
    const store = useLegalRequestsStore();

    mock.onGet("/api/legal_requests/1/files/2/download/").reply(200, new ArrayBuffer(10));

    await store.downloadFile(1, 2);

    expect(mock.history.get[0].headers.Authorization).toBeUndefined();
  });

  test("downloadFile throws when response status is not 200", async () => {
    const store = useLegalRequestsStore();

    mock.onGet("/api/legal_requests/1/files/2/download/").reply(204, new ArrayBuffer(1));

    await expect(store.downloadFile(1, 2)).rejects.toThrow("Failed to download file: HTTP 204");
  });
});
