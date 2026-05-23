const mockGetRequest = jest.fn();

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: (...args) => mockGetRequest(...args),
}));

import { useDocumentTabBadges } from "@/composables/useDocumentTabBadges";

describe("useDocumentTabBadges", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("fetchTabUnreadCounts calls the document-notification-counts endpoint", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: { counts: {} } });

    const { fetchTabUnreadCounts } = useDocumentTabBadges();
    await fetchTabUnreadCounts();

    expect(mockGetRequest).toHaveBeenCalledWith(
      "dynamic-documents/document-notification-counts/"
    );
  });

  test("fetchTabUnreadCounts stores the per-tab counts from the API response", async () => {
    mockGetRequest.mockResolvedValueOnce({
      data: { counts: { "signed-documents": 3, "archived-documents": 2 } },
    });

    const { fetchTabUnreadCounts, tabUnreadCounts } = useDocumentTabBadges();
    await fetchTabUnreadCounts();

    expect(tabUnreadCounts.value).toEqual({
      "signed-documents": 3,
      "archived-documents": 2,
    });
  });

  test("fetchTabUnreadCounts defaults to an empty map when the response omits counts", async () => {
    mockGetRequest.mockResolvedValueOnce({ data: {} });

    const { fetchTabUnreadCounts, tabUnreadCounts } = useDocumentTabBadges();
    await fetchTabUnreadCounts();

    expect(tabUnreadCounts.value).toEqual({});
  });

  test("fetchTabUnreadCounts resets counts to empty on a network error", async () => {
    mockGetRequest.mockRejectedValueOnce(new Error("network down"));

    const { fetchTabUnreadCounts, tabUnreadCounts, error } = useDocumentTabBadges();
    await fetchTabUnreadCounts();

    expect(tabUnreadCounts.value).toEqual({});
    expect(error.value).toBe("network down");
  });
});
