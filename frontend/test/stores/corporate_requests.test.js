import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useCorporateRequestsStore } from "@/stores/corporate_requests";

const mock = new AxiosMockAdapter(axios);

describe("Corporate Requests Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();

    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("initializes with empty state", () => {
    const store = useCorporateRequestsStore();

    expect(store.myRequests).toEqual([]);
    expect(store.receivedRequests).toEqual([]);
    expect(store.currentRequest).toBe(null);
    expect(store.availableOrganizations).toEqual([]);
    expect(store.requestTypes).toEqual([]);
    expect(store.requestResponses).toEqual([]);
    expect(store.dataLoaded).toBe(false);
  });

  test("getters: requestById, requestsByStatus, highPriorityRequests, pendingRequestsCount, requestTypeById", () => {
    const store = useCorporateRequestsStore();

    store.$patch({
      myRequests: [
        { id: 1, status: "PENDING", priority: "LOW" },
        { id: 2, status: "CLOSED", priority: "HIGH" },
      ],
      receivedRequests: [{ id: 3, status: "PENDING", priority: "URGENT" }],
      requestTypes: [{ id: 10, name: "Type" }],
    });

    expect(store.requestById(3).id).toBe(3);
    expect(store.requestsByStatus("PENDING").map((r) => r.id)).toEqual([1, 3]);
    expect(store.highPriorityRequests.map((r) => r.id)).toEqual([2, 3]);
    expect(store.pendingRequestsCount).toBe(2);
    expect(store.requestTypeById(10)).toEqual({ id: 10, name: "Type" });
  });

  test("getMyOrganizationsForRequests loads availableOrganizations", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet("/api/corporate-requests/clients/my-organizations/")
      .reply(200, { organizations: [{ id: 1 }] });

    const result = await store.getMyOrganizationsForRequests();

    expect(result.organizations).toEqual([{ id: 1 }]);
    expect(store.availableOrganizations).toEqual([{ id: 1 }]);
    expect(store.isLoading).toBe(false);
  });

  test("getMyOrganizationsForRequests throws when response status is not 200", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/clients/my-organizations/").reply(201, {
      organizations: [],
    });

    await expect(store.getMyOrganizationsForRequests()).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getMyOrganizationsForRequests resets loading on network error", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/clients/my-organizations/").networkError();

    await expect(store.getMyOrganizationsForRequests()).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
  });

  test("getRequestTypes supports both request_types wrapper and direct array", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet("/api/corporate-requests/clients/request-types/")
      .reply(200, { request_types: [{ id: 1 }] });

    const r1 = await store.getRequestTypes();

    expect(r1).toEqual([{ id: 1 }]);
    expect(store.requestTypes).toEqual([{ id: 1 }]);

    mock.resetHistory();
    mock
      .onGet("/api/corporate-requests/clients/request-types/")
      .reply(200, [{ id: 2 }]);

    const r2 = await store.getRequestTypes();

    expect(r2).toEqual([{ id: 2 }]);
    expect(store.requestTypes).toEqual([{ id: 2 }]);
  });

  test("getRequestTypes throws when response status is not 200", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/clients/request-types/").reply(204, {});

    await expect(store.getRequestTypes()).rejects.toBeTruthy();
    expect(store.isLoadingTypes).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getRequestTypes logs error details when request fails without response", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet("/api/corporate-requests/clients/request-types/")
      .networkError();

    await expect(store.getRequestTypes()).rejects.toBeTruthy();

    expect(console.error).toHaveBeenCalledWith("Error details:", undefined);
    expect(store.isLoadingTypes).toBe(false);
  });

  test("getRequestTypes logs error details when response data exists", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet("/api/corporate-requests/clients/request-types/")
      .reply(500, { detail: "boom" });

    await expect(store.getRequestTypes()).rejects.toBeTruthy();

    expect(console.error).toHaveBeenCalledWith("Error details:", { detail: "boom" });
    expect(store.isLoadingTypes).toBe(false);
  });

  test("createCorporateRequest unshifts request and sets currentRequest", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onPost("/api/corporate-requests/clients/create/")
      .reply(201, { corporate_request: { id: 1, title: "x" } });

    const result = await store.createCorporateRequest({ title: "x" });

    expect(result.corporate_request.id).toBe(1);
    expect(store.myRequests.map((r) => r.id)).toEqual([1]);
    expect(store.currentRequest.id).toBe(1);
    expect(store.isLoading).toBe(false);
  });

  test("createCorporateRequest throws when response status is not 201", async () => {
    const store = useCorporateRequestsStore();

    mock.onPost("/api/corporate-requests/clients/create/").reply(200, {
      corporate_request: { id: 1 },
    });

    await expect(store.createCorporateRequest({ title: "x" })).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("createCorporateRequest resets loading on network error", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onPost("/api/corporate-requests/clients/create/")
      .networkError();

    await expect(store.createCorporateRequest({ title: "x" })).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
  });

  test("getMyRequests sets list and pagination and builds query params", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet(/\/api\/corporate-requests\/clients\/my-requests\/.*/)
      .reply(200, { results: [{ id: 1 }], count: 1, next: null, previous: null });

    await store.getMyRequests({ status: "PENDING", search: "", page: 2, page_size: 20 });

    expect(store.myRequests).toEqual([{ id: 1 }]);
    expect(store.pagination.count).toBe(1);
    expect(store.pagination.currentPage).toBe(2);
    expect(store.pagination.pageSize).toBe(20);
    expect(store.dataLoaded).toBe(true);
    expect(store.isLoadingRequests).toBe(false);

    expect(mock.history.get).toHaveLength(1);
    const calledUrl = mock.history.get[0].url;
    expect(calledUrl).toContain("/api/corporate-requests/clients/my-requests/");
    expect(calledUrl).toContain("status=PENDING");
    expect(calledUrl).toContain("page=2");
    expect(calledUrl).toContain("page_size=20");
    expect(calledUrl).not.toContain("search=");
  });

  test("getMyRequests defaults pagination when page values are missing", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet("/api/corporate-requests/clients/my-requests/")
      .reply(200, { results: [], count: 0, next: null, previous: null });

    await store.getMyRequests();

    expect(store.pagination.currentPage).toBe(1);
    expect(store.pagination.pageSize).toBe(10);
    expect(store.isLoadingRequests).toBe(false);
  });

  test("getMyRequests throws when response status is not 200", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet(/\/api\/corporate-requests\/clients\/my-requests\/.*/)
      .reply(204, { results: [] });

    await expect(store.getMyRequests()).rejects.toBeTruthy();
    expect(store.isLoadingRequests).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getMyRequests resets loading on network error", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/clients/my-requests/").networkError();

    await expect(store.getMyRequests()).rejects.toBeTruthy();
    expect(store.isLoadingRequests).toBe(false);
  });

  test("getMyRequestDetail sets currentRequest and requestResponses and updates list", async () => {
    const store = useCorporateRequestsStore();

    store.myRequests = [{ id: 9, title: "old" }];

    mock
      .onGet("/api/corporate-requests/clients/9/")
      .reply(200, { corporate_request: { id: 9, title: "new", responses: [{ id: 1 }] } });

    const result = await store.getMyRequestDetail(9);

    expect(result.corporate_request.title).toBe("new");
    expect(store.currentRequest.title).toBe("new");
    expect(store.requestResponses).toEqual([{ id: 1 }]);
    expect(store.myRequests[0].title).toBe("new");
  });

  test("getMyRequestDetail uses empty responses when missing", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet("/api/corporate-requests/clients/10/")
      .reply(200, { corporate_request: { id: 10, title: "new" } });

    await store.getMyRequestDetail(10);

    expect(store.requestResponses).toEqual([]);
    expect(store.isLoading).toBe(false);
  });

  test("getMyRequestDetail throws when response status is not 200", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/clients/9/").reply(204, {});

    await expect(store.getMyRequestDetail(9)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getMyRequestDetail resets loading on network error", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/clients/9/").networkError();

    await expect(store.getMyRequestDetail(9)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
  });

  test("addResponseToMyRequest accepts string and updates currentRequest.responses", async () => {
    const store = useCorporateRequestsStore();

    store.currentRequest = { id: 9, response_count: 0, responses: [] };

    mock
      .onPost("/api/corporate-requests/clients/9/responses/")
      .reply(201, { response: { id: 2 } });

    const result = await store.addResponseToMyRequest(9, "hello");

    expect(result.response.id).toBe(2);
    expect(store.currentRequest.response_count).toBe(1);
    expect(store.currentRequest.responses).toEqual([{ id: 2 }]);

    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ response_text: "hello" });
  });

  test("addResponseToMyRequest creates responses array when missing", async () => {
    const store = useCorporateRequestsStore();

    store.currentRequest = { id: 9, response_count: 0 };

    mock
      .onPost("/api/corporate-requests/clients/9/responses/")
      .reply(201, { response: { id: 2 } });

    await store.addResponseToMyRequest(9, "hello");

    expect(store.currentRequest.response_count).toBe(1);
    expect(store.currentRequest.responses).toEqual([{ id: 2 }]);
  });

  test("addResponseToMyRequest falls back to requestResponses when no currentRequest", async () => {
    const store = useCorporateRequestsStore();

    store.currentRequest = null;
    store.requestResponses = [];

    mock
      .onPost("/api/corporate-requests/clients/9/responses/")
      .reply(201, { response: { id: 2 } });

    await store.addResponseToMyRequest(9, { response_text: "x" });

    expect(store.requestResponses).toEqual([{ id: 2 }]);
  });

  test("addResponseToMyRequest throws when response status is not 201", async () => {
    const store = useCorporateRequestsStore();

    mock.onPost("/api/corporate-requests/clients/9/responses/").reply(200, {
      response: { id: 2 },
    });

    await expect(store.addResponseToMyRequest(9, "hello")).rejects.toBeTruthy();
    expect(store.isLoadingResponses).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("addResponseToMyRequest resets loading on network error", async () => {
    const store = useCorporateRequestsStore();

    mock.onPost("/api/corporate-requests/clients/9/responses/").networkError();

    await expect(store.addResponseToMyRequest(9, "hello")).rejects.toBeTruthy();
    expect(store.isLoadingResponses).toBe(false);
  });

  test("getReceivedRequests sets list and pagination", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet(/\/api\/corporate-requests\/corporate\/received\/.*/)
      .reply(200, { results: [{ id: 1 }], count: 1, next: null, previous: null });

    await store.getReceivedRequests({ status: "PENDING", assigned_to_me: true, page: 1 });

    expect(store.receivedRequests).toEqual([{ id: 1 }]);
    expect(store.pagination.currentPage).toBe(1);
    expect(store.dataLoaded).toBe(true);

    expect(mock.history.get).toHaveLength(1);
    const calledUrl = mock.history.get[0].url;
    expect(calledUrl).toContain("/api/corporate-requests/corporate/received/");
    expect(calledUrl).toContain("status=PENDING");
    expect(calledUrl).toContain("assigned_to_me=true");
  });

  test("getReceivedRequests skips empty or null params in query string", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet(/\/api\/corporate-requests\/corporate\/received\/.*/)
      .reply(200, { results: [], count: 0, next: null, previous: null });

    await store.getReceivedRequests({
      status: "",
      priority: null,
      search: undefined,
      assigned_to_me: "",
      page: 1,
      page_size: 10,
    });

    const calledUrl = mock.history.get[0].url;
    expect(calledUrl).toContain("page=1");
    expect(calledUrl).toContain("page_size=10");
    expect(calledUrl).not.toContain("status=");
    expect(calledUrl).not.toContain("priority=");
    expect(calledUrl).not.toContain("search=");
    expect(calledUrl).not.toContain("assigned_to_me");
  });

  test("getReceivedRequests defaults pagination when page values are missing", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet("/api/corporate-requests/corporate/received/")
      .reply(200, { results: [], count: 0, next: null, previous: null });

    await store.getReceivedRequests();

    expect(store.pagination.currentPage).toBe(1);
    expect(store.pagination.pageSize).toBe(10);
    expect(store.isLoadingRequests).toBe(false);
  });

  test("getReceivedRequests throws when response status is not 200", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet(/\/api\/corporate-requests\/corporate\/received\/.*/)
      .reply(204, { results: [] });

    await expect(store.getReceivedRequests()).rejects.toBeTruthy();
    expect(store.isLoadingRequests).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getReceivedRequests resets loading on network error", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/corporate/received/").networkError();

    await expect(store.getReceivedRequests()).rejects.toBeTruthy();
    expect(store.isLoadingRequests).toBe(false);
  });

  test("getReceivedRequestDetail sets currentRequest and requestResponses and updates list", async () => {
    const store = useCorporateRequestsStore();

    store.receivedRequests = [{ id: 9, title: "old" }];

    mock
      .onGet("/api/corporate-requests/corporate/9/")
      .reply(200, { corporate_request: { id: 9, title: "new", responses: [{ id: 1 }] } });

    const result = await store.getReceivedRequestDetail(9);

    expect(result.corporate_request.title).toBe("new");
    expect(store.currentRequest.title).toBe("new");
    expect(store.requestResponses).toEqual([{ id: 1 }]);
    expect(store.receivedRequests[0].title).toBe("new");
  });

  test("getReceivedRequestDetail uses empty responses when missing", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet("/api/corporate-requests/corporate/10/")
      .reply(200, { corporate_request: { id: 10, title: "new" } });

    await store.getReceivedRequestDetail(10);

    expect(store.requestResponses).toEqual([]);
    expect(store.isLoading).toBe(false);
  });

  test("getReceivedRequestDetail throws when response status is not 200", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/corporate/9/").reply(204, {});

    await expect(store.getReceivedRequestDetail(9)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getReceivedRequestDetail resets loading on network error", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/corporate/9/").networkError();

    await expect(store.getReceivedRequestDetail(9)).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
  });

  test("addResponseToReceivedRequest accepts string, defaults is_internal_note false, and updates currentRequest.responses", async () => {
    const store = useCorporateRequestsStore();

    store.currentRequest = { id: 9, response_count: 0, responses: [] };

    mock
      .onPost("/api/corporate-requests/corporate/9/responses/")
      .reply(201, { response: { id: 2 } });

    const result = await store.addResponseToReceivedRequest(9, "hello");

    expect(result.response.id).toBe(2);
    expect(store.currentRequest.response_count).toBe(1);
    expect(store.currentRequest.responses).toEqual([{ id: 2 }]);

    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      response_text: "hello",
      is_internal_note: false,
    });
  });

  test("addResponseToReceivedRequest creates responses array when missing", async () => {
    const store = useCorporateRequestsStore();

    store.currentRequest = { id: 9, response_count: 0 };

    mock
      .onPost("/api/corporate-requests/corporate/9/responses/")
      .reply(201, { response: { id: 2 } });

    await store.addResponseToReceivedRequest(9, "hello");

    expect(store.currentRequest.response_count).toBe(1);
    expect(store.currentRequest.responses).toEqual([{ id: 2 }]);
  });

  test("addResponseToReceivedRequest falls back to requestResponses when no currentRequest", async () => {
    const store = useCorporateRequestsStore();

    store.currentRequest = null;
    store.requestResponses = [];

    mock
      .onPost("/api/corporate-requests/corporate/9/responses/")
      .reply(201, { response: { id: 2 } });

    await store.addResponseToReceivedRequest(9, { response_text: "x", is_internal_note: true });

    expect(store.requestResponses).toEqual([{ id: 2 }]);

    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      response_text: "x",
      is_internal_note: true,
    });
  });

  test("addResponseToReceivedRequest throws when response status is not 201", async () => {
    const store = useCorporateRequestsStore();

    mock.onPost("/api/corporate-requests/corporate/9/responses/").reply(200, {
      response: { id: 2 },
    });

    await expect(store.addResponseToReceivedRequest(9, "hello")).rejects.toBeTruthy();
    expect(store.isLoadingResponses).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("addResponseToReceivedRequest resets loading on network error", async () => {
    const store = useCorporateRequestsStore();

    mock.onPost("/api/corporate-requests/corporate/9/responses/").networkError();

    await expect(store.addResponseToReceivedRequest(9, "hello")).rejects.toBeTruthy();
    expect(store.isLoadingResponses).toBe(false);
  });

  test("getDashboardStats sets dashboardStats", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/corporate/dashboard-stats/").reply(200, {
      total_requests: 1,
    });

    const result = await store.getDashboardStats();

    expect(result.total_requests).toBe(1);
    expect(store.dashboardStats.total_requests).toBe(1);
    expect(store.isLoading).toBe(false);
  });

  test("getDashboardStats throws when response status is not 200", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/corporate/dashboard-stats/").reply(204, {});

    await expect(store.getDashboardStats()).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getDashboardStats resets loading on network error", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onGet("/api/corporate-requests/corporate/dashboard-stats/")
      .networkError();

    await expect(store.getDashboardStats()).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
  });

  test("getRequestConversation sets requestResponses", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/9/conversation/").reply(200, {
      responses: [{ id: 1 }],
    });

    const result = await store.getRequestConversation(9);

    expect(result.responses).toEqual([{ id: 1 }]);
    expect(store.requestResponses).toEqual([{ id: 1 }]);
    expect(store.isLoadingResponses).toBe(false);
  });

  test("getRequestConversation throws when response status is not 200", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/9/conversation/").reply(204, {});

    await expect(store.getRequestConversation(9)).rejects.toBeTruthy();
    expect(store.isLoadingResponses).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("getRequestConversation resets loading on network error", async () => {
    const store = useCorporateRequestsStore();

    mock.onGet("/api/corporate-requests/9/conversation/").networkError();

    await expect(store.getRequestConversation(9)).rejects.toBeTruthy();
    expect(store.isLoadingResponses).toBe(false);
  });

  test("updateReceivedRequest updates state via _updateRequestInState", async () => {
    const store = useCorporateRequestsStore();

    store.receivedRequests = [{ id: 9, status: "PENDING" }];
    store.currentRequest = { id: 9, status: "PENDING" };

    mock
      .onPut("/api/corporate-requests/corporate/9/update/")
      .reply(200, { corporate_request: { id: 9, status: "RESOLVED" } });

    const result = await store.updateReceivedRequest(9, { status: "RESOLVED" });

    expect(result.corporate_request.status).toBe("RESOLVED");
    expect(store.receivedRequests[0].status).toBe("RESOLVED");
    expect(store.currentRequest.status).toBe("RESOLVED");
  });

  test("updateReceivedRequest throws when response status is not 200", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onPut("/api/corporate-requests/corporate/9/update/")
      .reply(204, { corporate_request: { id: 9, status: "RESOLVED" } });

    await expect(store.updateReceivedRequest(9, { status: "RESOLVED" })).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("updateReceivedRequest resets loading on network error", async () => {
    const store = useCorporateRequestsStore();

    mock
      .onPut("/api/corporate-requests/corporate/9/update/")
      .networkError();

    await expect(store.updateReceivedRequest(9, { status: "RESOLVED" })).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
  });

  test("updateReceivedRequest rethrows request errors", async () => {
    const store = useCorporateRequestsStore();

    mock.onPut("/api/corporate-requests/corporate/9/update/").reply(500, { error: "x" });

    await expect(store.updateReceivedRequest(9, { status: "RESOLVED" })).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  test("updateFilters delegates to getMyRequests/getReceivedRequests by role", async () => {
    const store = useCorporateRequestsStore();

    const mySpy = jest.spyOn(store, "getMyRequests").mockResolvedValue({});
    const receivedSpy = jest.spyOn(store, "getReceivedRequests").mockResolvedValue({});

    await store.updateFilters({ status: "PENDING", search: "x" }, "client");
    expect(mySpy).toHaveBeenCalled();

    mySpy.mockClear();
    store.filters.assigned_to_me = true;
    await store.updateFilters({ status: "PENDING" }, "corporate_client");
    expect(receivedSpy).toHaveBeenCalled();

    const params = receivedSpy.mock.calls[0][0];
    expect(params.status).toBe("PENDING");
    expect(params.page).toBe(1);
    expect(params.assigned_to_me).toBe(true);
  });

  test("updateFilters does nothing for unsupported role", async () => {
    const store = useCorporateRequestsStore();

    const mySpy = jest.spyOn(store, "getMyRequests").mockResolvedValue({});
    const receivedSpy = jest.spyOn(store, "getReceivedRequests").mockResolvedValue({});

    await store.updateFilters({ status: "PENDING" }, "admin");

    expect(mySpy).not.toHaveBeenCalled();
    expect(receivedSpy).not.toHaveBeenCalled();
  });

  test("clearAll resets state", () => {
    const store = useCorporateRequestsStore();

    store.$patch({
      myRequests: [{ id: 1 }],
      receivedRequests: [{ id: 2 }],
      currentRequest: { id: 3 },
      availableOrganizations: [{ id: 4 }],
      requestTypes: [{ id: 5 }],
      requestResponses: [{ id: 6 }],
      dataLoaded: true,
      lastFetchTime: "x",
    });

    store.clearAll();

    expect(store.myRequests).toEqual([]);
    expect(store.receivedRequests).toEqual([]);
    expect(store.currentRequest).toBe(null);
    expect(store.availableOrganizations).toEqual([]);
    expect(store.requestTypes).toEqual([]);
    expect(store.requestResponses).toEqual([]);
    expect(store.dataLoaded).toBe(false);
    expect(store.lastFetchTime).toBe(null);
  });

  test("clearFilters resets filters", () => {
    const store = useCorporateRequestsStore();

    store.filters = {
      status: "PENDING",
      priority: "HIGH",
      search: "x",
      assigned_to_me: true,
    };

    store.clearFilters();

    expect(store.filters).toEqual({
      status: null,
      priority: null,
      search: "",
      assigned_to_me: false,
    });
  });

  test("refreshRequests delegates by role and uses pagination", async () => {
    const store = useCorporateRequestsStore();

    store.pagination.currentPage = 2;
    store.pagination.pageSize = 20;

    const mySpy = jest.spyOn(store, "getMyRequests").mockResolvedValue({});
    const receivedSpy = jest.spyOn(store, "getReceivedRequests").mockResolvedValue({});

    await store.refreshRequests("client");
    expect(mySpy).toHaveBeenCalledWith({ page: 2, page_size: 20 });

    await store.refreshRequests("corporate_client");
    expect(receivedSpy).toHaveBeenCalledWith({ page: 2, page_size: 20 });
  });

  test("refreshRequests does nothing for unsupported role", async () => {
    const store = useCorporateRequestsStore();

    const mySpy = jest.spyOn(store, "getMyRequests").mockResolvedValue({});
    const receivedSpy = jest.spyOn(store, "getReceivedRequests").mockResolvedValue({});

    await store.refreshRequests("admin");

    expect(mySpy).not.toHaveBeenCalled();
    expect(receivedSpy).not.toHaveBeenCalled();
  });

  test("_updateRequestInState updates in all locations when present", () => {
    const store = useCorporateRequestsStore();

    store.myRequests = [{ id: 1, status: "PENDING" }];
    store.receivedRequests = [{ id: 1, status: "PENDING" }];
    store.currentRequest = { id: 1, status: "PENDING" };

    store._updateRequestInState(1, { id: 1, status: "CLOSED" });

    expect(store.myRequests[0].status).toBe("CLOSED");
    expect(store.receivedRequests[0].status).toBe("CLOSED");
    expect(store.currentRequest.status).toBe("CLOSED");
  });

  test("_updateRequestInState skips received/current when not matching", () => {
    const store = useCorporateRequestsStore();

    store.myRequests = [{ id: 1, status: "PENDING" }];
    store.receivedRequests = [{ id: 2, status: "PENDING" }];
    store.currentRequest = { id: 3, status: "PENDING" };

    store._updateRequestInState(1, { id: 1, status: "CLOSED" });

    expect(store.myRequests[0].status).toBe("CLOSED");
    expect(store.receivedRequests[0].status).toBe("PENDING");
    expect(store.currentRequest.status).toBe("PENDING");
  });

  test("getStatusDisplay/getPriorityDisplay return mapped labels and fallback", () => {
    const store = useCorporateRequestsStore();

    expect(store.getStatusDisplay("PENDING")).toBe("Pendiente");
    expect(store.getStatusDisplay("UNKNOWN")).toBe("UNKNOWN");

    expect(store.getPriorityDisplay("URGENT")).toBe("Urgente");
    expect(store.getPriorityDisplay("UNKNOWN")).toBe("UNKNOWN");
  });

  test("getPriorityColorClass/getStatusColorClass return mapped classes and fallback", () => {
    const store = useCorporateRequestsStore();

    expect(store.getPriorityColorClass("HIGH")).toContain("text-orange");
    expect(store.getPriorityColorClass("UNKNOWN")).toBe("text-gray-600 bg-gray-100");

    expect(store.getStatusColorClass("RESOLVED")).toContain("text-green");
    expect(store.getStatusColorClass("UNKNOWN")).toBe("text-gray-600 bg-gray-100");
  });
});
