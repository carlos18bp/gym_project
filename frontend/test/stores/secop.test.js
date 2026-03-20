import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useSecopStore } from "@/stores/secop/index";

const mock = new AxiosMockAdapter(axios);

describe("SECOP Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------
  // State & Getters
  // ---------------------------------------------------------------

  test("initializes collections as empty arrays", () => {
    const store = useSecopStore();

    expect(store.processes).toEqual([]);
    expect(store.classifications).toEqual([]);
    expect(store.alerts).toEqual([]);
    expect(store.savedViews).toEqual([]);
  });

  test("initializes loading, error, pagination, and filters with defaults", () => {
    const store = useSecopStore();

    expect(store.currentProcess).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.pagination.count).toBe(0);
    expect(store.pagination.currentPage).toBe(1);
    expect(store.availableFilters.entity_names).toEqual([]);
    expect(store.availableFilters.unspsc_codes).toEqual([]);
  });

  test("processById returns matching process", () => {
    const store = useSecopStore();
    store.$patch({ processes: [{ id: 1 }, { id: 2 }, { id: 3 }] });

    expect(store.processById(2)).toEqual({ id: 2 });
  });

  test("processById returns undefined for non-existent id", () => {
    const store = useSecopStore();
    store.$patch({ processes: [{ id: 1 }] });

    expect(store.processById(999)).toBeUndefined();
  });

  test("openProcesses filters by is_open", () => {
    const store = useSecopStore();
    store.$patch({
      processes: [
        { id: 1, is_open: true },
        { id: 2, is_open: false },
        { id: 3, is_open: true },
      ],
    });

    expect(store.openProcesses.map((p) => p.id)).toEqual([1, 3]);
  });

  test("classifiedProcesses filters by my_classification not null", () => {
    const store = useSecopStore();
    store.$patch({
      processes: [
        { id: 1, my_classification: { status: "INTERESTING" } },
        { id: 2, my_classification: null },
      ],
    });

    expect(store.classifiedProcesses.map((p) => p.id)).toEqual([1]);
  });

  test("activeAlertsCount counts active alerts", () => {
    const store = useSecopStore();
    store.$patch({
      alerts: [
        { id: 1, is_active: true },
        { id: 2, is_active: false },
        { id: 3, is_active: true },
      ],
    });

    expect(store.activeAlertsCount).toBe(2);
  });

  // ---------------------------------------------------------------
  // Process actions
  // ---------------------------------------------------------------

  test("fetchProcesses sets processes and pagination on success", async () => {
    const store = useSecopStore();
    const responseData = {
      results: [{ id: 1 }, { id: 2 }],
      count: 2,
      total_pages: 1,
      current_page: 1,
      page_size: 20,
    };

    mock.onGet(/secop\/processes\//).reply(200, responseData);

    await store.fetchProcesses();

    expect(store.processes).toEqual([{ id: 1 }, { id: 2 }]);
    expect(store.pagination.count).toBe(2);
    expect(store.loading).toBe(false);
  });

  test("fetchProcesses sets error on failure", async () => {
    const store = useSecopStore();

    mock.onGet(/secop\/processes\//).reply(500);

    await expect(store.fetchProcesses()).rejects.toThrow();
    expect(store.error).toBeTruthy();
    expect(store.loading).toBe(false);
  });

  test("fetchProcesses builds query params from filters", async () => {
    const store = useSecopStore();
    const responseData = {
      results: [],
      count: 0,
      total_pages: 0,
      current_page: 1,
      page_size: 20,
    };

    mock.onGet(/secop\/processes\//).reply(200, responseData);

    await store.fetchProcesses({
      department: "Antioquia",
      search: "consultoría",
      ordering: "-publication_date",
    });

    const requestUrl = mock.history.get[0].url;
    expect(requestUrl).toContain("department=Antioquia");
    expect(requestUrl).toContain("search=consultor");
    expect(requestUrl).toContain("ordering=-publication_date");
  });

  test("fetchProcessDetail sets currentProcess on success", async () => {
    const store = useSecopStore();
    const processData = { id: 5, process_id: "CO1.REQ.5" };

    mock.onGet(/secop\/processes\/5\//).reply(200, processData);

    await store.fetchProcessDetail(5);

    expect(store.currentProcess).toEqual(processData);
    expect(store.loading).toBe(false);
  });

  test("fetchMyClassified filters by classification status", async () => {
    const store = useSecopStore();
    const responseData = {
      results: [{ id: 1 }],
      count: 1,
      total_pages: 1,
      current_page: 1,
    };

    mock.onGet(/secop\/processes\/my-classified\//).reply(200, responseData);

    await store.fetchMyClassified("INTERESTING");

    expect(store.processes).toEqual([{ id: 1 }]);
    const requestUrl = mock.history.get[0].url;
    expect(requestUrl).toContain("classification_status=INTERESTING");
  });

  // ---------------------------------------------------------------
  // Classification actions
  // ---------------------------------------------------------------

  test("createClassification updates local process my_classification", async () => {
    const store = useSecopStore();
    store.$patch({ processes: [{ id: 10, my_classification: null }] });

    const classificationData = { id: 1, status: "APPLIED", notes: "test" };
    mock.onPost(/secop\/classifications\//).reply(201, classificationData);

    await store.createClassification({ process: 10, status: "APPLIED" });

    expect(store.processes[0].my_classification).toEqual(classificationData);
  });

  test("createClassification refreshes detail when viewing current process", async () => {
    const store = useSecopStore();
    store.$patch({
      processes: [{ id: 10, my_classification: null }],
      currentProcess: { id: 10, classifications: [] },
    });

    const classificationData = { id: 1, status: "APPLIED" };
    const detailData = {
      id: 10,
      classifications: [{ id: 1, status: "APPLIED", is_mine: true }],
    };

    mock.onPost(/secop\/classifications\//).reply(201, classificationData);
    mock.onGet(/secop\/processes\/10\//).reply(200, detailData);

    await store.createClassification({ process: 10, status: "APPLIED" });

    expect(store.currentProcess.classifications).toHaveLength(1);
  });

  test("deleteClassification clears my_classification on process", async () => {
    const store = useSecopStore();
    store.$patch({
      processes: [
        { id: 10, my_classification: { id: 1, status: "INTERESTING" } },
      ],
    });

    mock.onDelete(/secop\/classifications\/1\//).reply(204);

    await store.deleteClassification(1, 10);

    expect(store.processes[0].my_classification).toBeNull();
  });

  test("deleteClassification sets error on failure", async () => {
    const store = useSecopStore();

    mock.onDelete(/secop\/classifications\/1\//).reply(500);

    await expect(store.deleteClassification(1, 10)).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  // ---------------------------------------------------------------
  // Alert actions
  // ---------------------------------------------------------------

  test("fetchAlerts populates alerts array", async () => {
    const store = useSecopStore();
    const alertsData = [
      { id: 1, name: "Alert 1" },
      { id: 2, name: "Alert 2" },
    ];

    mock.onGet(/secop\/alerts\//).reply(200, alertsData);

    await store.fetchAlerts();

    expect(store.alerts).toEqual(alertsData);
  });

  test("createAlert prepends to alerts", async () => {
    const store = useSecopStore();
    store.$patch({ alerts: [{ id: 1, name: "Existing" }] });

    const newAlert = { id: 2, name: "New Alert" };
    mock.onPost(/secop\/alerts\//).reply(201, newAlert);

    await store.createAlert({ name: "New Alert" });

    expect(store.alerts[0]).toEqual(newAlert);
    expect(store.alerts).toHaveLength(2);
  });

  test("updateAlert replaces in alerts array", async () => {
    const store = useSecopStore();
    store.$patch({ alerts: [{ id: 1, name: "Old Name" }] });

    const updatedAlert = { id: 1, name: "Updated Name" };
    mock.onPut(/secop\/alerts\/1\//).reply(200, updatedAlert);

    await store.updateAlert(1, { name: "Updated Name" });

    expect(store.alerts[0].name).toBe("Updated Name");
  });

  test("deleteAlert removes from alerts array", async () => {
    const store = useSecopStore();
    store.$patch({
      alerts: [
        { id: 1, name: "Keep" },
        { id: 2, name: "Delete" },
      ],
    });

    mock.onDelete(/secop\/alerts\/2\//).reply(204);

    await store.deleteAlert(2);

    expect(store.alerts).toHaveLength(1);
    expect(store.alerts[0].id).toBe(1);
  });

  test("toggleAlert updates is_active in array", async () => {
    const store = useSecopStore();
    store.$patch({ alerts: [{ id: 1, is_active: true }] });

    mock.onPost(/secop\/alerts\/1\/toggle\//).reply(200, {
      id: 1,
      is_active: false,
    });

    await store.toggleAlert(1);

    expect(store.alerts[0].is_active).toBe(false);
  });

  test("createAlert sets error on failure", async () => {
    const store = useSecopStore();

    mock.onPost(/secop\/alerts\//).reply(500);

    await expect(store.createAlert({ name: "Fail" })).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  // ---------------------------------------------------------------
  // Saved views, Filters, Sync actions
  // ---------------------------------------------------------------

  test("fetchSavedViews populates savedViews", async () => {
    const store = useSecopStore();
    const viewsData = [{ id: 1, name: "View 1" }];

    mock.onGet(/secop\/saved-views\//).reply(200, viewsData);

    await store.fetchSavedViews();

    expect(store.savedViews).toEqual(viewsData);
  });

  test("createSavedView prepends to savedViews", async () => {
    const store = useSecopStore();
    store.$patch({ savedViews: [{ id: 1, name: "Existing" }] });

    const newView = { id: 2, name: "New View" };
    mock.onPost(/secop\/saved-views\//).reply(201, newView);

    await store.createSavedView({ name: "New View", filters: {} });

    expect(store.savedViews[0]).toEqual(newView);
    expect(store.savedViews).toHaveLength(2);
  });

  test("deleteSavedView removes from savedViews", async () => {
    const store = useSecopStore();
    store.$patch({
      savedViews: [
        { id: 1, name: "Keep" },
        { id: 2, name: "Delete" },
      ],
    });

    mock.onDelete(/secop\/saved-views\/2\//).reply(204);

    await store.deleteSavedView(2);

    expect(store.savedViews).toHaveLength(1);
    expect(store.savedViews[0].id).toBe(1);
  });

  test("fetchAvailableFilters populates availableFilters", async () => {
    const store = useSecopStore();
    const filtersData = {
      departments: ["Antioquia", "Bogotá D.C."],
      procurement_methods: ["Licitación pública"],
      statuses: ["Abierto"],
      contract_types: ["Obra"],
    };

    mock.onGet(/secop\/filters\//).reply(200, filtersData);

    await store.fetchAvailableFilters();

    expect(store.availableFilters).toEqual(filtersData);
  });

  test("fetchSyncStatus sets syncStatus", async () => {
    const store = useSecopStore();
    const syncData = {
      last_success: { finished_at: "2026-03-19T14:00:00Z" },
      recent: [],
      total_processes: 150,
    };

    mock.onGet(/secop\/sync\//).reply(200, syncData);

    await store.fetchSyncStatus();

    expect(store.syncStatus).toEqual(syncData);
  });

  test("triggerSync returns response data", async () => {
    const store = useSecopStore();

    mock.onPost(/secop\/sync\/trigger\//).reply(200, {
      detail: "Sync triggered.",
    });

    const result = await store.triggerSync();

    expect(result.detail).toBe("Sync triggered.");
  });

  test("fetchProcesses sends entity_name and unspsc_code params", async () => {
    const store = useSecopStore();
    const responseData = {
      results: [],
      count: 0,
      total_pages: 0,
      current_page: 1,
      page_size: 25,
    };

    mock.onGet(/secop\/processes\//).reply(200, responseData);

    await store.fetchProcesses({
      entity_name: "Ministerio de Transporte",
      unspsc_code: "72101500",
      page_size: 25,
    });

    const requestUrl = mock.history.get[0].url;
    expect(requestUrl).toContain("entity_name=Ministerio");
    expect(requestUrl).toContain("unspsc_code=72101500");
    expect(requestUrl).toContain("page_size=25");
  });

  test("fetchProcesses sends date range and budget params", async () => {
    const store = useSecopStore();
    const responseData = {
      results: [],
      count: 0,
      total_pages: 0,
      current_page: 1,
      page_size: 20,
    };

    mock.onGet(/secop\/processes\//).reply(200, responseData);

    await store.fetchProcesses({
      min_budget: "100000000",
      max_budget: "500000000",
      publication_date_from: "2026-01-01",
      closing_date_to: "2026-12-31",
    });

    const requestUrl = mock.history.get[0].url;
    expect(requestUrl).toContain("min_budget=100000000");
    expect(requestUrl).toContain("max_budget=500000000");
    expect(requestUrl).toContain("publication_date_from=2026-01-01");
    expect(requestUrl).toContain("closing_date_to=2026-12-31");
  });

  // ---------------------------------------------------------------
  // Error / edge-case branches for full coverage
  // ---------------------------------------------------------------

  test("fetchProcesses non-200 response throws", async () => {
    const store = useSecopStore();
    const responseData = { detail: "forbidden" };

    mock.onGet(/secop\/processes\//).reply(403, responseData);

    await expect(store.fetchProcesses()).rejects.toThrow();
    expect(store.error).toBeTruthy();
    expect(store.loading).toBe(false);
  });

  test("fetchProcessDetail sets error on failure", async () => {
    const store = useSecopStore();

    mock.onGet(/secop\/processes\/99\//).reply(500);

    await expect(store.fetchProcessDetail(99)).rejects.toThrow();
    expect(store.error).toBeTruthy();
    expect(store.loading).toBe(false);
  });

  test("fetchProcessDetail non-200 response throws", async () => {
    const store = useSecopStore();

    mock.onGet(/secop\/processes\/5\//).reply(403, { detail: "forbidden" });

    await expect(store.fetchProcessDetail(5)).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  test("fetchMyClassified sets error on failure", async () => {
    const store = useSecopStore();

    mock.onGet(/secop\/processes\/my-classified\//).reply(500);

    await expect(store.fetchMyClassified()).rejects.toThrow();
    expect(store.error).toBeTruthy();
    expect(store.loading).toBe(false);
  });

  test("fetchMyClassified without status sends no classification_status param", async () => {
    const store = useSecopStore();
    const responseData = {
      results: [{ id: 1 }],
      count: 1,
      total_pages: 1,
      current_page: 1,
    };

    mock.onGet(/secop\/processes\/my-classified\//).reply(200, responseData);

    await store.fetchMyClassified();

    const requestUrl = mock.history.get[0].url;
    expect(requestUrl).not.toContain("classification_status");
  });

  test("createClassification non-201 response throws", async () => {
    const store = useSecopStore();

    mock.onPost(/secop\/classifications\//).reply(403, { detail: "forbidden" });

    await expect(
      store.createClassification({ process: 10, status: "APPLIED" }),
    ).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  test("deleteClassification when process not in array does not crash", async () => {
    const store = useSecopStore();
    store.$patch({ processes: [] });

    mock.onDelete(/secop\/classifications\/1\//).reply(204);

    await store.deleteClassification(1, 999);

    expect(store.processes).toEqual([]);
  });

  test("deleteClassification refreshes detail when currentProcess matches", async () => {
    const store = useSecopStore();
    store.$patch({
      processes: [],
      currentProcess: { id: 10, classifications: [] },
    });

    const detailData = {
      id: 10,
      classifications: [],
    };

    mock.onDelete(/secop\/classifications\/1\//).reply(204);
    mock.onGet(/secop\/processes\/10\//).reply(200, detailData);

    await store.deleteClassification(1, 10);

    expect(store.currentProcess).toEqual(detailData);
  });

  test("fetchAlerts sets error on failure", async () => {
    const store = useSecopStore();

    mock.onGet(/secop\/alerts\//).reply(500);

    await expect(store.fetchAlerts()).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  test("updateAlert when alert not in array does not crash", async () => {
    const store = useSecopStore();
    store.$patch({ alerts: [] });

    const updatedAlert = { id: 999, name: "Ghost Alert" };
    mock.onPut(/secop\/alerts\/999\//).reply(200, updatedAlert);

    const result = await store.updateAlert(999, { name: "Ghost Alert" });

    expect(result).toEqual(updatedAlert);
    expect(store.alerts).toHaveLength(0);
  });

  test("toggleAlert sets error on failure", async () => {
    const store = useSecopStore();

    mock.onPost(/secop\/alerts\/1\/toggle\//).reply(500);

    await expect(store.toggleAlert(1)).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  test("toggleAlert when alert not in array does not crash", async () => {
    const store = useSecopStore();
    store.$patch({ alerts: [] });

    mock.onPost(/secop\/alerts\/999\/toggle\//).reply(200, {
      id: 999,
      is_active: true,
    });

    const result = await store.toggleAlert(999);

    expect(result).toEqual({ id: 999, is_active: true });
    expect(store.alerts).toHaveLength(0);
  });

  test("fetchSavedViews sets error on failure", async () => {
    const store = useSecopStore();

    mock.onGet(/secop\/saved-views\//).reply(500);

    await expect(store.fetchSavedViews()).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  test("createSavedView sets error on failure", async () => {
    const store = useSecopStore();

    mock.onPost(/secop\/saved-views\//).reply(500);

    await expect(
      store.createSavedView({ name: "Fail", filters: {} }),
    ).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  test("deleteSavedView sets error on failure", async () => {
    const store = useSecopStore();

    mock.onDelete(/secop\/saved-views\/1\//).reply(500);

    await expect(store.deleteSavedView(1)).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  test("fetchAvailableFilters sets error on failure", async () => {
    const store = useSecopStore();

    mock.onGet(/secop\/filters\//).reply(500);

    await expect(store.fetchAvailableFilters()).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  test("fetchSyncStatus sets error on failure", async () => {
    const store = useSecopStore();

    mock.onGet(/secop\/sync\//).reply(500);

    await expect(store.fetchSyncStatus()).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  test("triggerSync sets error on failure", async () => {
    const store = useSecopStore();

    mock.onPost(/secop\/sync\/trigger\//).reply(500);

    await expect(store.triggerSync()).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  test("exportExcel sets error on failure", async () => {
    const store = useSecopStore();

    mock.onGet(/secop\/export\//).reply(500);

    await expect(store.exportExcel()).rejects.toThrow();
    expect(store.error).toBeTruthy();
  });

  test("exportExcel with empty params sends no query string", async () => {
    const store = useSecopStore();

    mock.onGet(/secop\/export\//).reply(200, new ArrayBuffer(10), {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const createObjectURL = jest.fn(() => "blob:test");
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    const appendChild = jest
      .spyOn(document.body, "appendChild")
      .mockImplementation(() => {});
    const removeChild = jest
      .spyOn(document.body, "removeChild")
      .mockImplementation(() => {});

    await store.exportExcel();

    const requestUrl = mock.history.get[0].url;
    expect(requestUrl).not.toContain("?");

    appendChild.mockRestore();
    removeChild.mockRestore();
  });

  test("exportExcel sends new filter params", async () => {
    const store = useSecopStore();

    mock.onGet(/secop\/export\//).reply(200, new ArrayBuffer(10), {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Stub DOM APIs for download
    const createObjectURL = jest.fn(() => "blob:test");
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    const appendChild = jest.spyOn(document.body, "appendChild").mockImplementation(() => {});
    const removeChild = jest.spyOn(document.body, "removeChild").mockImplementation(() => {});

    await store.exportExcel({
      entity_name: "INVIAS",
      unspsc_code: "81101500",
      min_budget: "50000000",
    });

    const requestUrl = mock.history.get[0].url;
    expect(requestUrl).toContain("entity_name=INVIAS");
    expect(requestUrl).toContain("unspsc_code=81101500");
    expect(requestUrl).toContain("min_budget=50000000");

    appendChild.mockRestore();
    removeChild.mockRestore();
  });
});

