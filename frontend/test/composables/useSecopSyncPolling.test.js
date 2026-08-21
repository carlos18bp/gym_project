import { useSecopSyncPolling } from "@/composables/useSecopSyncPolling";

function buildStore(status = null) {
  return {
    syncStatus: status,
    fetchSyncStatus: jest.fn(),
    triggerSync: jest.fn().mockResolvedValue({ detail: "Sync triggered." }),
  };
}

describe("useSecopSyncPolling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("trigger starts polling after the backend accepts the task", async () => {
    const store = buildStore({ recent: [{ id: 1, status: "SUCCESS" }] });
    const polling = useSecopSyncPolling(store, { pollIntervalMs: 10 });

    await polling.triggerSync();

    expect(store.triggerSync).toHaveBeenCalledTimes(1);
    expect(polling.syncPolling.value).toBe(true);
  });

  test("trigger ignores a duplicate request while polling", async () => {
    const store = buildStore({ recent: [{ id: 1, status: "SUCCESS" }] });
    const polling = useSecopSyncPolling(store, { pollIntervalMs: 10 });

    await polling.triggerSync();
    await polling.triggerSync();

    expect(store.triggerSync).toHaveBeenCalledTimes(1);
  });

  test("new successful log refreshes the SECOP data", async () => {
    const store = buildStore({ recent: [{ id: 1, status: "SUCCESS" }] });
    const onSuccess = jest.fn();
    store.fetchSyncStatus.mockImplementation(() => {
      store.syncStatus = { recent: [{ id: 2, status: "SUCCESS" }] };
    });
    const polling = useSecopSyncPolling(store, {
      onSuccess,
      pollIntervalMs: 10,
    });

    await polling.triggerSync();
    await jest.advanceTimersByTimeAsync(10);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(polling.syncPolling.value).toBe(false);
  });

  test("failed log remains authoritative after polling expires", async () => {
    const store = buildStore({ recent: [{ id: 1, status: "SUCCESS" }] });
    store.fetchSyncStatus.mockImplementation(() => {
      store.syncStatus = { recent: [{ id: 2, status: "FAILED" }] };
    });
    const polling = useSecopSyncPolling(store, {
      pollIntervalMs: 10,
      maxAttempts: 2,
    });

    await polling.triggerSync();
    await jest.advanceTimersByTimeAsync(20);

    expect(store.syncStatus.recent[0].status).toBe("FAILED");
    expect(polling.syncPolling.value).toBe(false);
  });

  test("running server log resumes polling", async () => {
    const store = buildStore({ recent: [{ id: 7, status: "IN_PROGRESS" }] });
    store.fetchSyncStatus.mockImplementation(() => {
      store.syncStatus = { recent: [{ id: 7, status: "SUCCESS" }] };
    });
    const polling = useSecopSyncPolling(store, { pollIntervalMs: 10 });

    polling.resumeRunningSync();
    await jest.advanceTimersByTimeAsync(10);

    expect(store.fetchSyncStatus).toHaveBeenCalledTimes(1);
    expect(polling.syncPolling.value).toBe(false);
  });

  test("stop cancels the next status request", async () => {
    const store = buildStore({ recent: [{ id: 1, status: "SUCCESS" }] });
    const polling = useSecopSyncPolling(store, { pollIntervalMs: 10 });

    await polling.triggerSync();
    polling.stopSyncPolling();
    await jest.advanceTimersByTimeAsync(10);

    expect(polling.syncPolling.value).toBe(false);
    expect(store.fetchSyncStatus).not.toHaveBeenCalled();
  });
});
