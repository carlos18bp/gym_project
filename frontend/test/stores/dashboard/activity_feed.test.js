import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useActivityFeedStore, registerUserActivity } from "@/stores/dashboard/activity_feed";
import * as requestHttp from "@/stores/services/request_http";

const mock = new AxiosMockAdapter(axios);

const fetchActivities = async (items) => {
  const store = useActivityFeedStore();
  mock.onGet("/api/user-activities/").reply(200, items);
  await store.fetchUserActivities();
  return store;
};

const timesFor = (store, ids) =>
  ids.map((id) => store.activities.find((activity) => activity.id === id)?.time);

describe("Activity Feed Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  test("registerUserActivity normalizes invalid action types to 'other'", async () => {
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const createRequestSpy = jest
      .spyOn(requestHttp, "create_request")
      .mockResolvedValueOnce({
        data: {
          id: 1,
          action_type: "other",
          description: "x",
          created_at: "2026-01-31T00:00:00Z",
        },
      });

    await registerUserActivity("INVALID", "x");

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(createRequestSpy).toHaveBeenCalledWith("create-activity/", {
      action_type: "other",
      description: "x",
    });

    createRequestSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  test("registerUserActivity throws on backend error", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const error = new Error("error");
    const createRequestSpy = jest
      .spyOn(requestHttp, "create_request")
      .mockRejectedValueOnce(error);

    await expect(registerUserActivity("create", "x")).rejects.toBe(error);

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error registering activity:", error);

    createRequestSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("fetchUserActivities maps activities and sets loading flags", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-31T00:00:30Z"));

    const store = useActivityFeedStore();

    mock.onGet("/api/user-activities/").reply(200, [
      {
        id: 1,
        action_type: "create",
        description: "Created",
        created_at: "2026-01-31T00:00:10Z",
      },
    ]);

    await store.fetchUserActivities();

    expect(store.loading).toBe(false);
    expect(store.error).toBe(null);
    expect(store.activities).toHaveLength(1);
    expect(store.activities[0]).toEqual({
      id: 1,
      type: "create",
      description: "Created",
      time: "Hace unos segundos",
    });

    jest.useRealTimers();
  });

  test("fetchUserActivities sets error on invalid response format", async () => {
    const store = useActivityFeedStore();

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/user-activities/").reply(200, { not: "array" });

    await store.fetchUserActivities();

    expect(store.error).toBe("Invalid response format from server");

    consoleErrorSpy.mockRestore();
  });

  test("fetchUserActivities sets error on request failure", async () => {
    const store = useActivityFeedStore();

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/user-activities/").reply(500, { detail: "bad" });

    await store.fetchUserActivities();

    expect(store.error).toBe("bad");

    consoleErrorSpy.mockRestore();
  });

  test("createActivity unshifts new activity on success", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-31T00:01:00Z"));

    const store = useActivityFeedStore();

    mock.onPost("/api/create-activity/").reply(200, {
      id: 10,
      action_type: "update",
      description: "Updated",
      created_at: "2026-01-31T00:00:50Z",
    });

    await store.createActivity("update", "Updated");

    expect(store.activities[0]).toEqual({
      id: 10,
      type: "update",
      description: "Updated",
      time: "Hace unos segundos",
    });

    jest.useRealTimers();
  });

  test("createActivity sets error when registerUserActivity fails", async () => {
    const store = useActivityFeedStore();

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/create-activity/").reply(500, { detail: "fail" });

    await store.createActivity("create", "x");

    expect(store.error).toBe("fail");

    consoleErrorSpy.mockRestore();
  });

  test("registerActivity unshifts only if activities already loaded", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-31T00:01:00Z"));

    const store = useActivityFeedStore();

    // Empty list: should NOT unshift
    mock.onPost("/api/create-activity/").replyOnce(200, {
      id: 1,
      action_type: "create",
      description: "A",
      created_at: "2026-01-31T00:00:50Z",
    });

    const first = await store.registerActivity("create", "A");
    expect(first.id).toBe(1);
    expect(store.activities).toEqual([]);

    // Loaded list: should unshift
    store.activities = [{ id: 99, type: "other", description: "existing", time: "x" }];

    mock.onPost("/api/create-activity/").replyOnce(200, {
      id: 2,
      action_type: "delete",
      description: "B",
      created_at: "2026-01-31T00:00:50Z",
    });

    const second = await store.registerActivity("delete", "B");
    expect(second.id).toBe(2);
    expect(store.activities[0].id).toBe(2);

    jest.useRealTimers();
  });

  test("fetchUserActivities formats seconds/minutes/hours", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-31T12:00:00Z"));

    const store = await fetchActivities([
      { id: 1, action_type: "other", description: "sec", created_at: "2026-01-31T11:59:50Z" },
      { id: 2, action_type: "other", description: "1m", created_at: "2026-01-31T11:59:00Z" },
      { id: 3, action_type: "other", description: "2m", created_at: "2026-01-31T11:58:00Z" },
      { id: 4, action_type: "other", description: "1h", created_at: "2026-01-31T11:00:00Z" },
      { id: 5, action_type: "other", description: "2h", created_at: "2026-01-31T10:00:00Z" },
    ]);

    expect(timesFor(store, [1, 2, 3, 4, 5])).toEqual([
      "Hace unos segundos",
      "Hace 1 minuto",
      "Hace 2 minutos",
      "Hace 1 hora",
      "Hace 2 horas",
    ]);

    jest.useRealTimers();
  });

  test("fetchUserActivities formats days and weeks", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-31T12:00:00Z"));

    const store = await fetchActivities([
      { id: 6, action_type: "other", description: "1d", created_at: "2026-01-30T12:00:00Z" },
      { id: 7, action_type: "other", description: "2d", created_at: "2026-01-29T12:00:00Z" },
      { id: 8, action_type: "other", description: "1w", created_at: "2026-01-24T12:00:00Z" },
      { id: 9, action_type: "other", description: "2w", created_at: "2026-01-17T12:00:00Z" },
    ]);

    expect(timesFor(store, [6, 7, 8, 9])).toEqual([
      "Hace 1 día",
      "Hace 2 días",
      "Hace 1 semana",
      "Hace 2 semanas",
    ]);

    jest.useRealTimers();
  });

  test("fetchUserActivities formats months and years", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-31T12:00:00Z"));

    const store = await fetchActivities([
      { id: 10, action_type: "other", description: "1mo", created_at: "2026-01-01T12:00:00Z" },
      { id: 11, action_type: "other", description: "2mo", created_at: "2025-12-02T12:00:00Z" },
      { id: 12, action_type: "other", description: "1y", created_at: "2025-01-31T12:00:00Z" },
      { id: 13, action_type: "other", description: "2y", created_at: "2024-01-31T12:00:00Z" },
    ]);

    expect(timesFor(store, [10, 11, 12, 13])).toEqual([
      "Hace 1 mes",
      "Hace 2 meses",
      "Hace 1 año",
      "Hace 2 años",
    ]);

    jest.useRealTimers();
  });

  test("fetchUserActivities error fallback message when backend detail is missing", async () => {
    const store = useActivityFeedStore();
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/user-activities/").reply(500, {});
    await store.fetchUserActivities();

    expect(store.error).toBe("Error fetching activity feed");
    consoleErrorSpy.mockRestore();
  });

  test("createActivity error fallback message when backend detail is missing", async () => {
    const store = useActivityFeedStore();
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/create-activity/").reply(500, {});
    await store.createActivity("create", "x");

    expect(store.error).toBe("Error creating activity");
    consoleErrorSpy.mockRestore();
  });

  test("registerActivity rethrows when registerUserActivity fails", async () => {
    const store = useActivityFeedStore();
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/create-activity/").reply(500, { detail: "fail" });
    await expect(store.registerActivity("create", "x")).rejects.toBeTruthy();

    consoleErrorSpy.mockRestore();
  });
});
