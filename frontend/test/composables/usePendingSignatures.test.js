const mockGetRequest = jest.fn();

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: (...args) => mockGetRequest(...args),
}));

import { usePendingSignatures } from "@/composables/usePendingSignatures";

describe("usePendingSignatures", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test("fetchPendingCount stores count from API response", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: { pending_count: 4 } });

    const { fetchPendingCount, pendingCount, hasPending } = usePendingSignatures();
    await fetchPendingCount();

    expect(mockGetRequest).toHaveBeenCalledWith(
      "dynamic-documents/pending-signatures-count/"
    );
    expect(pendingCount.value).toBe(4);
    expect(hasPending.value).toBe(true);
  });

  test("markAlerted writes the sessionStorage flag", () => {
    const { markAlerted } = usePendingSignatures();
    markAlerted();

    expect(sessionStorage.getItem("pendingSignaturesAlerted")).toBe("true");
  });

  test("hasAlertedThisSession reflects sessionStorage state at composable creation", () => {
    sessionStorage.setItem("pendingSignaturesAlerted", "true");

    const { hasAlertedThisSession } = usePendingSignatures();

    expect(hasAlertedThisSession.value).toBe(true);
  });

  test("resetAlertFlag removes the sessionStorage flag", () => {
    sessionStorage.setItem("pendingSignaturesAlerted", "true");

    const { resetAlertFlag } = usePendingSignatures();
    resetAlertFlag();

    expect(sessionStorage.getItem("pendingSignaturesAlerted")).toBeNull();
  });

  test("shouldAlert is true when pending exist and session is not alerted", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: { pending_count: 2 } });

    const { fetchPendingCount, shouldAlert } = usePendingSignatures();
    await fetchPendingCount();

    expect(shouldAlert.value).toBe(true);
  });

  test("shouldAlert is false when sessionStorage already marked as alerted", async () => {
    sessionStorage.setItem("pendingSignaturesAlerted", "true");
    mockGetRequest.mockResolvedValueOnce({ data: { pending_count: 2 } });

    const { fetchPendingCount, shouldAlert } = usePendingSignatures();
    await fetchPendingCount();

    expect(shouldAlert.value).toBe(false);
  });

  test("shouldAlert is false when there are no pending signatures", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: { pending_count: 0 } });

    const { fetchPendingCount, shouldAlert } = usePendingSignatures();
    await fetchPendingCount();

    expect(shouldAlert.value).toBe(false);
  });
});
