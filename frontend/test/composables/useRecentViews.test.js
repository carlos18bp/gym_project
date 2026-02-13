const mockCreateRequest = jest.fn();

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  create_request: (...args) => mockCreateRequest(...args),
}));

import { useRecentViews } from "@/composables/useRecentViews";

describe("useRecentViews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("registerView calls correct endpoint for process", async () => {
    const { registerView } = useRecentViews();

    await registerView("process", 123);

    expect(mockCreateRequest).toHaveBeenCalledWith("update-recent-process/123/", "POST");
  });

  test("registerView calls correct endpoint for document", async () => {
    const { registerView } = useRecentViews();

    await registerView("document", 10);

    expect(mockCreateRequest).toHaveBeenCalledWith("dynamic-documents/10/update-recent/", "POST");
  });

  test("registerView does nothing when resourceId is missing", async () => {
    const { registerView } = useRecentViews();

    await registerView("document", null);
    await registerView("document", undefined);
    await registerView("document", "");

    expect(mockCreateRequest).not.toHaveBeenCalled();
  });

  test("registerView warns and does nothing for unknown resource type", async () => {
    const { registerView } = useRecentViews();

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await registerView("unknown", 1);

    expect(mockCreateRequest).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "No endpoint configured for resource type: unknown"
    );

    warnSpy.mockRestore();
  });

  test("registerView catches create_request errors", async () => {
    const { registerView } = useRecentViews();

    mockCreateRequest.mockRejectedValueOnce(new Error("fail"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(registerView("document", 10)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
