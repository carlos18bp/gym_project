import { setActivePinia, createPinia } from "pinia";

import { useSecopStore } from "@/stores/secop/index";

jest.mock("@/stores/services/request_http", () => ({
  get_request: jest.fn(),
  create_request: jest.fn(),
  update_request: jest.fn(),
  delete_request: jest.fn(),
}));

const {
  get_request,
  create_request,
  update_request,
} = require("@/stores/services/request_http");

describe("SECOP Store — non-200 status branches", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  test("fetchProcesses throws when status is not 200", async () => {
    const store = useSecopStore();
    get_request.mockResolvedValue({ status: 403, data: {} });

    await expect(store.fetchProcesses()).rejects.toThrow("Failed to fetch SECOP processes");
    expect(store.error).toBeTruthy();
  });

  test("fetchProcessDetail throws when status is not 200", async () => {
    const store = useSecopStore();
    get_request.mockResolvedValue({ status: 403, data: {} });

    await expect(store.fetchProcessDetail(1)).rejects.toThrow("Failed to fetch process detail");
    expect(store.error).toBeTruthy();
  });

  test("fetchMyClassified throws when status is not 200", async () => {
    const store = useSecopStore();
    get_request.mockResolvedValue({ status: 403, data: {} });

    await expect(store.fetchMyClassified()).rejects.toThrow("Failed to fetch classified processes");
    expect(store.error).toBeTruthy();
  });

  test("createClassification throws when status is not 201", async () => {
    const store = useSecopStore();
    create_request.mockResolvedValue({ status: 403, data: {} });

    await expect(
      store.createClassification({ process: 1, status: "APPLIED" }),
    ).rejects.toThrow("Failed to create classification");
    expect(store.error).toBeTruthy();
  });

  test("fetchAlerts throws when status is not 200", async () => {
    const store = useSecopStore();
    get_request.mockResolvedValue({ status: 403, data: {} });

    await expect(store.fetchAlerts()).rejects.toThrow("Failed to fetch alerts");
    expect(store.error).toBeTruthy();
  });

  test("createAlert throws when status is not 201", async () => {
    const store = useSecopStore();
    create_request.mockResolvedValue({ status: 403, data: {} });

    await expect(store.createAlert({ name: "Test" })).rejects.toThrow("Failed to create alert");
    expect(store.error).toBeTruthy();
  });

  test("updateAlert throws when status is not 200", async () => {
    const store = useSecopStore();
    update_request.mockResolvedValue({ status: 403, data: {} });

    await expect(store.updateAlert(1, { name: "Test" })).rejects.toThrow("Failed to update alert");
    expect(store.error).toBeTruthy();
  });

  test("toggleAlert throws when status is not 200", async () => {
    const store = useSecopStore();
    create_request.mockResolvedValue({ status: 403, data: {} });

    await expect(store.toggleAlert(1)).rejects.toThrow("Failed to toggle alert");
    expect(store.error).toBeTruthy();
  });

  test("fetchSavedViews throws when status is not 200", async () => {
    const store = useSecopStore();
    get_request.mockResolvedValue({ status: 403, data: {} });

    await expect(store.fetchSavedViews()).rejects.toThrow("Failed to fetch saved views");
    expect(store.error).toBeTruthy();
  });

  test("createSavedView throws when status is not 201", async () => {
    const store = useSecopStore();
    create_request.mockResolvedValue({ status: 403, data: {} });

    await expect(
      store.createSavedView({ name: "Test", filters: {} }),
    ).rejects.toThrow("Failed to create saved view");
    expect(store.error).toBeTruthy();
  });

  test("fetchAvailableFilters throws when status is not 200", async () => {
    const store = useSecopStore();
    get_request.mockResolvedValue({ status: 403, data: {} });

    await expect(store.fetchAvailableFilters()).rejects.toThrow("Failed to fetch filters");
    expect(store.error).toBeTruthy();
  });

  test("deleteAlert sets error on failure", async () => {
    const store = useSecopStore();
    const { delete_request } = require("@/stores/services/request_http");
    delete_request.mockRejectedValue(new Error("Network error"));

    await expect(store.deleteAlert(1)).rejects.toThrow("Network error");
    expect(store.error).toBe("Network error");
  });

  test("fetchSyncStatus throws when status is not 200", async () => {
    const store = useSecopStore();
    get_request.mockResolvedValue({ status: 403, data: {} });

    await expect(store.fetchSyncStatus()).rejects.toThrow("Failed to fetch sync status");
    expect(store.error).toBeTruthy();
  });
});
