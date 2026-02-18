const mockCreateRequest = jest.fn();
const mockShowNotification = jest.fn();
const mockShowLoading = jest.fn();
const mockHideLoading = jest.fn();

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  create_request: (...args) => mockCreateRequest(...args),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/shared/loading_message", () => ({
  __esModule: true,
  showLoading: (...args) => mockShowLoading(...args),
  hideLoading: (...args) => mockHideLoading(...args),
}));

import { useSendEmail } from "@/composables/useSendEmail";

describe("useSendEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowNotification.mockResolvedValue();
    mockCreateRequest.mockResolvedValue({ data: { ok: true } });
  });

  test("sendEmail: throws and notifies when toEmail is missing", async () => {
    const { sendEmail, isLoading, errorMessage } = useSendEmail();

    await expect(sendEmail("some-endpoint/", "")).rejects.toThrow(
      "Recipient email is required."
    );

    expect(errorMessage.value).toBe("Recipient email is required.");
    expect(isLoading.value).toBe(false);

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Recipient email is required.",
      "error"
    );

    expect(mockShowLoading).not.toHaveBeenCalled();
    expect(mockHideLoading).not.toHaveBeenCalled();
    expect(mockCreateRequest).not.toHaveBeenCalled();
  });

  const runSendEmailSuccess = async () => {
    const { sendEmail, isLoading, errorMessage } = useSendEmail();

    const file1 = new File(["hello"], "hello.txt", { type: "text/plain" });

    const resultPromise = sendEmail(
      "dynamic-documents/send_email_with_attachments/",
      "to@test.com",
      "Subject",
      "Body",
      [file1],
      { extra_key: "extra_value" }
    );

    expect(isLoading.value).toBe(true);

    const result = await resultPromise;

    return { result, isLoading, errorMessage, file1 };
  };

  test("sendEmail: notifies success and clears loading state", async () => {
    const { result, isLoading, errorMessage } = await runSendEmailSuccess();

    expect(result).toEqual({ ok: true });
    expect(mockShowLoading).toHaveBeenCalledWith(
      "Sending email...",
      "Please wait while we send the email."
    );
    expect(mockHideLoading).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Email sent successfully.",
      "success"
    );
    expect([errorMessage.value, isLoading.value]).toEqual(["", false]);
  });

  test("sendEmail: sends FormData with attachments and extra params", async () => {
    const { file1 } = await runSendEmailSuccess();

    const [endpointArg, formDataArg] = mockCreateRequest.mock.calls[0];
    expect(endpointArg).toBe("dynamic-documents/send_email_with_attachments/");
    expect(formDataArg).toBeInstanceOf(FormData);
    expect([
      formDataArg.get("to_email"),
      formDataArg.get("subject"),
      formDataArg.get("body"),
      formDataArg.get("extra_key"),
      formDataArg.get("attachments[0]"),
    ]).toEqual(["to@test.com", "Subject", "Body", "extra_value", file1]);
  });

  test("sendEmail: hides loading, notifies error, sets errorMessage and rethrows when request fails", async () => {
    const { sendEmail, isLoading, errorMessage } = useSendEmail();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("fail");

    mockCreateRequest.mockRejectedValueOnce(error);

    await expect(sendEmail("some-endpoint/", "to@test.com")).rejects.toBe(error);

    expect(mockShowLoading).toHaveBeenCalled();
    expect(mockHideLoading).toHaveBeenCalled();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "An error occurred while sending the email. Please try again.",
      "error"
    );

    expect(errorMessage.value).toBe(
      "An error occurred while sending the email. Please try again."
    );

    expect(isLoading.value).toBe(false);

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("sendEmail: handles failure when success notification rejects", async () => {
    const { sendEmail, isLoading, errorMessage } = useSendEmail();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const notifyError = new Error("notify fail");

    mockCreateRequest.mockResolvedValueOnce({ data: { ok: true } });
    mockShowNotification
      .mockRejectedValueOnce(notifyError)
      .mockResolvedValueOnce();

    await expect(sendEmail("some-endpoint/", "to@test.com")).rejects.toBe(
      notifyError
    );

    expect(mockShowLoading).toHaveBeenCalled();
    expect(mockHideLoading).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "An error occurred while sending the email. Please try again.",
      "error"
    );
    expect(errorMessage.value).toBe(
      "An error occurred while sending the email. Please try again."
    );
    expect(isLoading.value).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
