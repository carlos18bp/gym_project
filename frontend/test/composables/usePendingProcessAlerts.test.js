const mockGetRequest = jest.fn();

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: (...args) => mockGetRequest(...args),
}));

import { usePendingProcessAlerts } from "@/composables/usePendingProcessAlerts";

describe("usePendingProcessAlerts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("fetchPendingCount stores count from API response", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: { pending_count: 3 } });

    const { fetchPendingCount, pendingCount, hasPending } = usePendingProcessAlerts();
    await fetchPendingCount();

    expect(mockGetRequest).toHaveBeenCalledWith("processes/pending-alerts-count/");
    expect(pendingCount.value).toBe(3);
    expect(hasPending.value).toBe(true);
  });

  test("fetchPendingCount defaults to zero when pending_count is absent", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: {} });

    const { fetchPendingCount, pendingCount } = usePendingProcessAlerts();
    await fetchPendingCount();

    expect(pendingCount.value).toBe(0);
  });

  test("hasPending is false when there are no pending alerts", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: { pending_count: 0 } });

    const { fetchPendingCount, hasPending } = usePendingProcessAlerts();
    await fetchPendingCount();

    expect(hasPending.value).toBe(false);
  });

  test("fetchPendingCount records the error and resets the count on request failure", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockGetRequest.mockRejectedValueOnce(new Error("network down"));

    const { fetchPendingCount, pendingCount, error } = usePendingProcessAlerts();
    await fetchPendingCount();

    expect(error.value).toBe("network down");
    expect(pendingCount.value).toBe(0);

    console.error.mockRestore();
  });

  test("fetchPendingCount is a no-op while a previous fetch is in flight", async () => {
    let resolveRequest;
    mockGetRequest.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    const { fetchPendingCount } = usePendingProcessAlerts();
    const inFlight = fetchPendingCount();
    fetchPendingCount();

    expect(mockGetRequest).toHaveBeenCalledTimes(1);

    resolveRequest({ data: { pending_count: 1 } });
    await inFlight;
  });
});
