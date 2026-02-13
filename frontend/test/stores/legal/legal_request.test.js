import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useLegalRequestStore } from "@/stores/legal/legal_request";
import * as activityFeed from "@/stores/dashboard/activity_feed";

const mock = new AxiosMockAdapter(axios);

describe("Legal Request Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  test("fetchDropDownOptionsData loads options", async () => {
    const store = useLegalRequestStore();

    mock.onGet("/api/dropdown_options_legal_request/").reply(200, {
      legal_request_types: [{ id: 1 }],
      legal_disciplines: [{ id: 2 }],
    });

    await store.fetchDropDownOptionsData();

    expect(store.legalRequestTypes).toEqual([{ id: 1 }]);
    expect(store.legalDisciplines).toEqual([{ id: 2 }]);
    expect(store.dataLoaded).toBe(true);
  });

  test("fetchDropDownOptionsData defaults to empty arrays when fields are missing", async () => {
    const store = useLegalRequestStore();

    mock.onGet("/api/dropdown_options_legal_request/").reply(200, {});

    await store.fetchDropDownOptionsData();

    expect(store.legalRequestTypes).toEqual([]);
    expect(store.legalDisciplines).toEqual([]);
    expect(store.dataLoaded).toBe(true);
  });

  test("fetchDropDownOptionsData parses JSON string response", async () => {
    const store = useLegalRequestStore();

    mock.onGet("/api/dropdown_options_legal_request/").reply(
      200,
      JSON.stringify({ legal_request_types: [{ id: 1 }], legal_disciplines: [{ id: 2 }] })
    );

    await store.fetchDropDownOptionsData();

    expect(store.legalRequestTypes).toEqual([{ id: 1 }]);
    expect(store.legalDisciplines).toEqual([{ id: 2 }]);
    expect(store.dataLoaded).toBe(true);
  });

  test("fetchDropDownOptionsData handles invalid JSON string", async () => {
    const store = useLegalRequestStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/dropdown_options_legal_request/").reply(200, "not-json");

    await store.fetchDropDownOptionsData();

    expect(store.legalRequestTypes).toEqual([]);
    expect(store.legalDisciplines).toEqual([]);
    expect(store.dataLoaded).toBe(true);

    consoleSpy.mockRestore();
  });

  test("createLegalRequest returns null on request error", async () => {
    const store = useLegalRequestStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/create_legal_request/").networkError();

    const status = await store.createLegalRequest({
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
      requestTypeId: { id: 1, name: "Consulta" },
      disciplineId: { id: 2, name: "Civil" },
      description: "x",
      files: [],
    });

    expect(status).toBe(null);

    consoleSpy.mockRestore();
  });

  test("fetchDropDownOptionsData handles request failure", async () => {
    const store = useLegalRequestStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/dropdown_options_legal_request/").reply(500, { detail: "boom" });

    await store.fetchDropDownOptionsData();

    expect(store.legalRequestTypes).toEqual([]);
    expect(store.legalDisciplines).toEqual([]);
    expect(store.dataLoaded).toBe(false);

    consoleSpy.mockRestore();
  });

  test("init calls fetchDropDownOptionsData only if not loaded", async () => {
    const store = useLegalRequestStore();

    const spy = jest.spyOn(store, "fetchDropDownOptionsData").mockResolvedValue();

    await store.init();
    expect(spy).toHaveBeenCalled();

    spy.mockClear();
    store.dataLoaded = true;
    await store.init();
    expect(spy).not.toHaveBeenCalled();
  });

  test("createLegalRequest sets lastCreatedRequestId and schedules background tasks", async () => {
    jest.useFakeTimers();

    const store = useLegalRequestStore();

    const sendSpy = jest.spyOn(store, "sendConfirmationEmailAsync").mockResolvedValue();
    const uploadSpy = jest.spyOn(store, "uploadFilesAsync").mockResolvedValue();

    const file1 = new File(["a"], "a.txt", { type: "text/plain" });
    const file2 = new File(["b"], "b.txt", { type: "text/plain" });

    mock.onPost("/api/create_legal_request/").reply(201, { id: 123 });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const status = await store.createLegalRequest({
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
      requestTypeId: { id: 1, name: "Consulta" },
      disciplineId: { id: 2, name: "Civil" },
      description: "x",
      files: [file1, file2],
    });

    expect(status).toBe(201);
    expect(store.lastCreatedRequestId).toBe(123);

    // 200ms => confirmation
    jest.advanceTimersByTime(200);
    await Promise.resolve();
    expect(sendSpy).toHaveBeenCalledWith(123);

    // 300ms => files
    jest.advanceTimersByTime(100);
    await Promise.resolve();
    expect(uploadSpy).toHaveBeenCalledWith(123, [file1, file2]);

    jest.useRealTimers();
  });

  test("createLegalRequest uses default activity labels when names are missing", async () => {
    jest.useFakeTimers();

    const store = useLegalRequestStore();
    const activitySpy = jest
      .spyOn(activityFeed, "registerUserActivity")
      .mockResolvedValue({});
    const sendSpy = jest.spyOn(store, "sendConfirmationEmailAsync").mockResolvedValue();
    const uploadSpy = jest.spyOn(store, "uploadFilesAsync").mockResolvedValue();

    mock.onPost("/api/create_legal_request/").reply(201, { id: 321 });

    const status = await store.createLegalRequest({
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
      requestTypeId: { id: 1 },
      disciplineId: { id: 2 },
      description: "x",
      files: [],
    });

    expect(status).toBe(201);
    expect(activitySpy).toHaveBeenCalledWith(
      activityFeed.ACTION_TYPES.CREATE,
      "Radicaste una solicitud de legal."
    );

    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    activitySpy.mockRestore();
    sendSpy.mockRestore();
    uploadSpy.mockRestore();
  });

  test("createLegalRequest logs warning when activity registration fails", async () => {
    jest.useFakeTimers();

    const store = useLegalRequestStore();
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const activitySpy = jest.spyOn(activityFeed, "registerUserActivity").mockRejectedValue(new Error("fail"));
    const sendSpy = jest.spyOn(store, "sendConfirmationEmailAsync").mockResolvedValue();
    const uploadSpy = jest.spyOn(store, "uploadFilesAsync").mockResolvedValue();

    mock.onPost("/api/create_legal_request/").reply(201, { id: 123 });

    const status = await store.createLegalRequest({
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
      requestTypeId: { id: 1, name: "Consulta" },
      disciplineId: { id: 2, name: "Civil" },
      description: "x",
      files: [],
    });

    expect(status).toBe(201);

    await Promise.resolve();
    await Promise.resolve();
    expect(consoleWarnSpy).toHaveBeenCalled();

    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    consoleWarnSpy.mockRestore();
    activitySpy.mockRestore();
    sendSpy.mockRestore();
    uploadSpy.mockRestore();
  });

  test("uploadFilesAsync logs warning when response is not 201", async () => {
    const store = useLegalRequestStore();

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    mock.onPost("/api/upload_legal_request_file/").reply(200, { ok: true });

    await store.uploadFilesAsync(10, [new File(["a"], "a.txt")]);

    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  test("uploadFilesAsync logs error after retries are exhausted", async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0);

    const store = useLegalRequestStore();
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/upload_legal_request_file/").reply(500, { detail: "fail" });

    const promise = store.uploadFilesAsync(10, [new File(["a"], "a.txt")]);

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(4000);

    await promise;

    expect(consoleErrorSpy).toHaveBeenCalled();

    Math.random.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  test("sendConfirmationEmailAsync does not warn on 200 response", async () => {
    const store = useLegalRequestStore();

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    mock.onPost("/api/send_confirmation_email/").reply(200);

    await store.sendConfirmationEmailAsync(10);

    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  test("createLegalRequest returns null when backend does not return 201", async () => {
    const store = useLegalRequestStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/create_legal_request/").reply(200, {});

    const status = await store.createLegalRequest({
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
      requestTypeId: { id: 1, name: "Consulta" },
      disciplineId: { id: 2, name: "Civil" },
      description: "x",
      files: [],
    });

    expect(status).toBe(null);

    consoleSpy.mockRestore();
  });

  test("uploadFiles returns per-file success", async () => {
    const store = useLegalRequestStore();

    const file1 = new File(["a"], "a.txt", { type: "text/plain" });
    const file2 = new File(["b"], "b.txt", { type: "text/plain" });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/upload_legal_request_file/").replyOnce(201, { ok: true });
    mock.onPost("/api/upload_legal_request_file/").replyOnce(500, { detail: "error" });

    const results = await store.uploadFiles(10, [file1, file2]);

    expect(results).toEqual([
      { file: "a.txt", success: true },
      { file: "b.txt", success: false },
    ]);

    consoleSpy.mockRestore();
  });

  test("uploadFilesAsync retries and eventually succeeds", async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0);

    const store = useLegalRequestStore();

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/upload_legal_request_file/").replyOnce(500, { detail: "e1" });
    mock.onPost("/api/upload_legal_request_file/").replyOnce(500, { detail: "e2" });
    mock.onPost("/api/upload_legal_request_file/").replyOnce(201, { ok: true });

    const p = store.uploadFilesAsync(10, [new File(["a"], "a.txt")]);

    // allow first request
    await Promise.resolve();

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);

    await p;

    expect(mock.history.post.filter((r) => r.url === "/api/upload_legal_request_file/")).toHaveLength(3);

    Math.random.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  test("sendConfirmationEmailAsync warns on non-200 but does not throw", async () => {
    const store = useLegalRequestStore();

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    // 204 is a successful 2xx but not 200 => triggers warn branch
    mock.onPost("/api/send_confirmation_email/").reply(204);

    await store.sendConfirmationEmailAsync(10);

    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  test("sendConfirmationEmailAsync logs error on failure", async () => {
    const store = useLegalRequestStore();

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/send_confirmation_email/").reply(500, { detail: "boom" });

    await store.sendConfirmationEmailAsync(10);

    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  test("getLastCreatedRequestId returns the last created request ID", () => {
    const store = useLegalRequestStore();

    expect(store.getLastCreatedRequestId()).toBe(null);

    store.lastCreatedRequestId = 456;

    expect(store.getLastCreatedRequestId()).toBe(456);
  });
});
