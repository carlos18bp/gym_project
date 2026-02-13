import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useRecentProcessStore } from "@/stores/dashboard/recentProcess";

const mock = new AxiosMockAdapter(axios);

describe("Recent Process Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  test("fetchRecentProcesses loads recent processes and toggles loading", async () => {
    const store = useRecentProcessStore();

    mock.onGet("/api/recent-processes/").reply(200, [{ id: 1 }]);

    await store.fetchRecentProcesses();

    expect(store.isLoading).toBe(false);
    expect(store.recentProcesses).toEqual([{ id: 1 }]);
  });

  test("fetchRecentProcesses does nothing when already loading", async () => {
    const store = useRecentProcessStore();

    store.$patch({ isLoading: true, recentProcesses: [{ id: 99 }] });

    await store.fetchRecentProcesses();

    expect(mock.history.get).toHaveLength(0);
    expect(store.recentProcesses).toEqual([{ id: 99 }]);
  });

  test("fetchRecentProcesses clears recentProcesses on error", async () => {
    const store = useRecentProcessStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/recent-processes/").reply(500, { detail: "error" });

    await store.fetchRecentProcesses();

    expect(store.isLoading).toBe(false);
    expect(store.recentProcesses).toEqual([]);

    consoleSpy.mockRestore();
  });

  test("init calls fetchRecentProcesses", async () => {
    const store = useRecentProcessStore();

    mock.onGet("/api/recent-processes/").reply(200, []);

    const spy = jest.spyOn(store, "fetchRecentProcesses");

    await store.init();

    expect(spy).toHaveBeenCalled();
  });

  test("updateRecentProcess calls update endpoint and then refreshes list", async () => {
    const store = useRecentProcessStore();

    mock.onPost("/api/update-recent-process/10/").reply(200, { ok: true });
    mock.onGet("/api/recent-processes/").reply(200, [{ id: 10 }]);

    await store.updateRecentProcess(10);

    expect(store.recentProcesses).toEqual([{ id: 10 }]);
  });

  test("updateRecentProcess handles errors without throwing", async () => {
    const store = useRecentProcessStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/update-recent-process/10/").reply(500, { detail: "error" });

    await store.updateRecentProcess(10);

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
