import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useProcessStore } from "@/stores/process";
import { useUserStore } from "@/stores/auth/user";
import * as activityFeed from "@/stores/dashboard/activity_feed";

const mock = new AxiosMockAdapter(axios);

describe("Process Store behaviors", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    localStorage.clear();
    jest.clearAllMocks();
  });

  test("activeProcessesForCurrentUser returns empty array when no current user", () => {
    const store = useProcessStore();
    const userStore = useUserStore();

    userStore.$patch({ currentUser: null });
    store.$patch({
      processes: [
        {
          id: 1,
          stages: [{ status: "En curso" }],
          clients: [{ id: 1 }],
          lawyer: { id: 10 },
          case: { type: "Civil" },
        },
      ],
    });

    expect(store.activeProcessesForCurrentUser).toEqual([]);
  });

  test("fetchProcessesData parses string JSON response", async () => {
    const store = useProcessStore();

    const processes = [
      {
        id: 1,
        plaintiff: "A",
        defendant: "B",
        authority: "X",
        ref: "R",
        subcase: "S",
        case: { type: "Civil" },
        stages: [{ status: "En curso" }],
        clients: [],
        lawyer: { id: 1 },
      },
    ];

    mock.onGet("/api/processes/").reply(200, JSON.stringify(processes));

    await store.fetchProcessesData();

    expect(store.processes).toEqual(processes);
    expect(store.dataLoaded).toBe(true);
  });

  test("fetchProcessesData handles invalid JSON string by setting processes empty", async () => {
    const store = useProcessStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/processes/").reply(200, "not-json");

    await store.fetchProcessesData();

    expect(store.processes).toEqual([]);
    expect(store.dataLoaded).toBe(true);

    consoleSpy.mockRestore();
  });

  test("fetchProcessesData sets dataLoaded false on request failure", async () => {
    const store = useProcessStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/processes/").reply(500, { detail: "error" });

    await store.fetchProcessesData();

    expect(store.processes).toEqual([]);
    expect(store.dataLoaded).toBe(false);

    consoleSpy.mockRestore();
  });

  test("init does not refetch when dataLoaded is true", async () => {
    const store = useProcessStore();
    store.$patch({ dataLoaded: true, processes: [{ id: 1, stages: [{ status: "En curso" }], case: { type: "Civil" } }] });

    const fetchSpy = jest.spyOn(store, "fetchProcessesData");

    await store.init();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("processesWithClosedStatus and processesWithoutClosedStatus split by last stage status", () => {
    const store = useProcessStore();

    store.$patch({
      processes: [
        {
          id: 1,
          stages: [{ status: "En curso" }, { status: "Fallo" }],
          case: { type: "Civil" },
          clients: [],
          lawyer: { id: 10 },
        },
        {
          id: 2,
          stages: [{ status: "En curso" }],
          case: { type: "Laboral" },
          clients: [],
          lawyer: { id: 10 },
        },
        {
          id: 3,
          stages: [],
          case: { type: "Civil" },
          clients: [],
          lawyer: { id: 10 },
        },
      ],
    });

    expect(store.processesWithClosedStatus.map((p) => p.id)).toEqual([1]);
    expect(store.processesWithoutClosedStatus.map((p) => p.id)).toEqual([2]);
  });

  test("activeProcessesForCurrentUser filters for client", () => {
    const store = useProcessStore();
    const userStore = useUserStore();

    userStore.$patch({ currentUser: { id: 1, role: "client" } });

    store.$patch({
      processes: [
        {
          id: 1,
          stages: [{ status: "En curso" }],
          clients: [{ id: 1 }],
          lawyer: { id: 99 },
          case: { type: "Civil" },
        },
        {
          id: 2,
          stages: [{ status: "Fallo" }],
          clients: [{ id: 1 }],
          lawyer: { id: 99 },
          case: { type: "Civil" },
        },
        {
          id: 3,
          stages: [{ status: "En curso" }],
          clients: [{ id: 2 }],
          lawyer: { id: 99 },
          case: { type: "Civil" },
        },
      ],
    });

    expect(store.activeProcessesForCurrentUser.map((p) => p.id)).toEqual([1]);
  });

  test("activeProcessesForCurrentUser handles basic/corporate_client and unknown roles", () => {
    const store = useProcessStore();
    const userStore = useUserStore();

    store.$patch({
      processes: [
        {
          id: 1,
          stages: [{ status: "En curso" }],
          clients: [{ id: 1 }],
          lawyer: { id: 99 },
          case: { type: "Civil" },
        },
      ],
    });

    ["basic", "corporate_client"].forEach((role) => {
      userStore.$patch({ currentUser: { id: 1, role } });
      expect(store.activeProcessesForCurrentUser.map((p) => p.id)).toEqual([1]);
    });

    userStore.$patch({ currentUser: { id: 1, role: "guest" } });
    expect(store.activeProcessesForCurrentUser).toEqual([]);
  });

  test("processById returns undefined when process is missing", () => {
    const store = useProcessStore();

    store.$patch({ processes: [] });

    expect(store.processById(999)).toBeUndefined();
  });

  test("activeProcessesForCurrentUser filters for lawyer", () => {
    const store = useProcessStore();
    const userStore = useUserStore();

    userStore.$patch({ currentUser: { id: 10, role: "lawyer" } });

    store.$patch({
      processes: [
        {
          id: 1,
          stages: [{ status: "En curso" }],
          clients: [{ id: 1 }],
          lawyer: { id: 10 },
          case: { type: "Civil" },
        },
        {
          id: 2,
          stages: [{ status: "En curso" }],
          clients: [{ id: 1 }],
          lawyer: { id: 11 },
          case: { type: "Civil" },
        },
        {
          id: 3,
          stages: [{ status: "Fallo" }],
          clients: [{ id: 1 }],
          lawyer: { id: 10 },
          case: { type: "Civil" },
        },
      ],
    });

    expect(store.activeProcessesForCurrentUser.map((p) => p.id)).toEqual([1]);
  });

  test("filteredProcesses filters by displayParam, role, and query", () => {
    const store = useProcessStore();

    store.$patch({
      processes: [
        {
          id: 1,
          plaintiff: "Alice",
          defendant: "Bob",
          authority: "X",
          ref: "R1",
          subcase: "Sub",
          case: { type: "Civil" },
          stages: [{ status: "En curso" }],
          clients: [{ id: 1 }],
          lawyer: { id: 10 },
        },
        {
          id: 2,
          plaintiff: "Carol",
          defendant: "Dan",
          authority: "Y",
          ref: "R2",
          subcase: "Sub2",
          case: { type: "Laboral" },
          stages: [{ status: "Fallo" }],
          clients: [{ id: 1 }],
          lawyer: { id: 10 },
        },
      ],
    });

    // Open processes (not history) for client id=1
    const openForClient = store.filteredProcesses("", true, 1, "open");
    expect(openForClient.map((p) => p.id)).toEqual([1]);

    // History processes for lawyer id=10
    const historyForLawyer = store.filteredProcesses("", false, 10, "history");
    expect(historyForLawyer.map((p) => p.id)).toEqual([2]);

    // Search by case type
    const search = store.filteredProcesses("laboral", false, null, "history");
    expect(search.map((p) => p.id)).toEqual([2]);
  });

  test("createProcess posts mainData, uploads files, refreshes processes, and registers activity", async () => {
    const store = useProcessStore();

    const file1 = new File(["a"], "a.txt", { type: "text/plain" });

    const formData = {
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "Civil",
      ref: "R1",
      authority: "X",
      authorityEmail: "x@test.com",
      clientIds: [1],
      lawyerId: 10,
      progress: 0,
      stages: [{ status: "En curso" }],
      caseFiles: [{ file: file1 }, { file: "already-uploaded" }, { file: null }],
    };

    mock.onPost("/api/create_process/").reply(201, { id: 123 });
    mock.onPost("/api/update_case_file/").reply(201, { ok: true });
    mock.onGet("/api/processes/").reply(200, []);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const status = await store.createProcess(formData);

    expect(status).toBe(201);
    expect(store.dataLoaded).toBe(true);

    // One valid file should upload, invalid ones are skipped
    expect(mock.history.post.filter((r) => r.url === "/api/update_case_file/")).toHaveLength(1);

    // Activity registered
    const activityReq = mock.history.post.find((r) => r.url === "/api/create-activity/");
    expect(activityReq).toBeTruthy();
    const activityPayload = JSON.parse(activityReq.data);
    expect(activityPayload.action_type).toBe("create");
  });

  test("createProcess returns null on request error", async () => {
    const store = useProcessStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/create_process/").networkError();

    const status = await store.createProcess({
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "Civil",
      ref: "R1",
      authority: "X",
      authorityEmail: "x@test.com",
      clientIds: [1],
      lawyerId: 10,
      progress: 0,
      stages: [{ status: "En curso" }],
      caseFiles: [],
    });

    expect(status).toBe(null);

    consoleSpy.mockRestore();
  });

  test("updateProcess returns null when update_request throws", async () => {
    const store = useProcessStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/update_process/9/").networkError();

    const status = await store.updateProcess({
      processIdParam: 9,
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "Civil",
      ref: "R1",
      authority: "X",
      authorityEmail: "x@test.com",
      clientIds: [1],
      lawyerId: 10,
      progress: 0,
      stages: [{ status: "En curso" }],
      caseFiles: [],
    });

    expect(status).toBe(null);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("updateProcess returns null when backend returns unexpected success status", async () => {
    const store = useProcessStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/update_process/8/").reply(202, { id: 8 });

    const status = await store.updateProcess({
      processIdParam: 8,
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "Civil",
      ref: "R1",
      authority: "X",
      authorityEmail: "x@test.com",
      clientIds: [1],
      lawyerId: 10,
      progress: 0,
      stages: [{ status: "En curso" }],
      caseFiles: [],
    });

    expect(status).toBe(null);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("createProcess warns when some files fail to upload", async () => {
    const store = useProcessStore();

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const file1 = new File(["a"], "a.txt", { type: "text/plain" });
    const file2 = new File(["b"], "b.txt", { type: "text/plain" });

    mock.onPost("/api/create_process/").reply(201, { id: 123 });
    mock.onPost("/api/update_case_file/").replyOnce(201, { ok: true });
    mock.onPost("/api/update_case_file/").replyOnce(500, { detail: "error" });
    mock.onGet("/api/processes/").reply(200, []);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const status = await store.createProcess({
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "Civil",
      ref: "R1",
      authority: "X",
      authorityEmail: "x@test.com",
      clientIds: [1],
      lawyerId: 10,
      progress: 0,
      stages: [{ status: "En curso" }],
      caseFiles: [{ file: file1 }, { file: file2 }],
    });

    expect(status).toBe(201);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("createProcess returns null when backend does not return 201", async () => {
    const store = useProcessStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/create_process/").reply(200, { id: 123 });

    const status = await store.createProcess({
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "Civil",
      ref: "R1",
      authority: "X",
      authorityEmail: "x@test.com",
      clientIds: [1],
      lawyerId: 10,
      progress: 0,
      stages: [{ status: "En curso" }],
      caseFiles: [],
    });

    expect(status).toBe(null);

    consoleSpy.mockRestore();
  });

  test("updateProcess registers EDIT when last stage is not Fallo", async () => {
    const store = useProcessStore();

    mock.onPut("/api/update_process/5/").reply(200);
    mock.onGet("/api/processes/").reply(200, []);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const status = await store.updateProcess({
      processIdParam: 5,
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "Civil",
      ref: "R1",
      authority: "X",
      authorityEmail: "x@test.com",
      clientIds: [1],
      lawyerId: 10,
      progress: 0,
      stages: [{ status: "En curso" }],
      caseFiles: [],
    });

    expect(status).toBe(200);

    const activityReq = mock.history.post.find((r) => r.url === "/api/create-activity/");
    const activityPayload = JSON.parse(activityReq.data);
    expect(activityPayload.action_type).toBe("edit");
  });

  test("updateProcess registers FINISH when last stage is Fallo (archiving)", async () => {
    const store = useProcessStore();

    mock.onPut("/api/update_process/5/").reply(200);
    mock.onGet("/api/processes/").reply(200, []);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const status = await store.updateProcess({
      processIdParam: 5,
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "Civil",
      ref: "R1",
      authority: "X",
      authorityEmail: "x@test.com",
      clientIds: [1],
      lawyerId: 10,
      progress: 0,
      stages: [{ status: "En curso" }, { status: "Fallo" }],
      caseFiles: [],
      isArchiving: true,
    });

    expect(status).toBe(200);

    const activityReq = mock.history.post.find((r) => r.url === "/api/create-activity/");
    const activityPayload = JSON.parse(activityReq.data);
    expect(activityPayload.action_type).toBe("finish");
  });

  test("updateProcess registers FINISH when last stage is Fallo (not archiving)", async () => {
    const store = useProcessStore();

    mock.onPut("/api/update_process/6/").reply(200);
    mock.onGet("/api/processes/").reply(200, []);
    mock.onPost("/api/create-activity/").reply(200, { id: 2 });

    const status = await store.updateProcess({
      processIdParam: 6,
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "Civil",
      ref: "R1",
      authority: "X",
      authorityEmail: "x@test.com",
      clientIds: [1],
      lawyerId: 10,
      progress: 0,
      stages: [{ status: "En curso" }, { status: "Fallo" }],
      caseFiles: [],
      isArchiving: false,
    });

    expect(status).toBe(200);

    const activityReq = mock.history.post.find((r) => r.url === "/api/create-activity/");
    const activityPayload = JSON.parse(activityReq.data);
    expect(activityPayload.action_type).toBe("finish");
    expect(activityPayload.description).toContain("Finalizaste el proceso");
  });

  test("updateProcess uploads files and warns when some fail", async () => {
    const store = useProcessStore();

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/update_process/7/").reply(200);
    mock.onPost("/api/update_case_file/").replyOnce(201, { ok: true });
    mock.onPost("/api/update_case_file/").replyOnce(500, { detail: "error" });
    mock.onGet("/api/processes/").reply(200, []);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const file1 = new File(["a"], "a.txt", { type: "text/plain" });
    const file2 = new File(["b"], "b.txt", { type: "text/plain" });

    const status = await store.updateProcess({
      processIdParam: 7,
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "Civil",
      ref: "R1",
      authority: "X",
      authorityEmail: "x@test.com",
      clientIds: [1],
      lawyerId: 10,
      progress: 0,
      stages: [{ status: "En curso" }],
      caseFiles: [{ file: file1 }, { file: file2 }],
    });

    expect(status).toBe(200);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("updateProcess returns null when backend status is not 200/201", async () => {
    const store = useProcessStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/update_process/5/").reply(500, { detail: "error" });

    const status = await store.updateProcess({
      processIdParam: 5,
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "Civil",
      ref: "R1",
      authority: "X",
      authorityEmail: "x@test.com",
      clientIds: [1],
      lawyerId: 10,
      progress: 0,
      stages: [{ status: "En curso" }],
      caseFiles: [],
    });

    expect(status).toBe(null);

    consoleSpy.mockRestore();
  });

  test("uploadFiles skips string/empty entries, returns per-file success results", async () => {
    const store = useProcessStore();

    const file1 = new File(["a"], "a.txt", { type: "text/plain" });
    const file2 = new File(["b"], "b.txt", { type: "text/plain" });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/update_case_file/").replyOnce(201, { ok: true });
    mock.onPost("/api/update_case_file/").replyOnce(500, { detail: "error" });

    const results = await store.uploadFiles(1, [
      { file: "existing" },
      null,
      { file: file1 },
      { file: file2 },
    ]);

    expect(results).toEqual([
      { file: "a.txt", success: true },
      { file: "b.txt", success: false },
    ]);

    consoleSpy.mockRestore();
  });

  test("fetchProcessById returns existing process when dataLoaded", async () => {
    const store = useProcessStore();

    store.$patch({
      processes: [{ id: 1, stages: [{ status: "En curso" }], case: { type: "Civil" } }],
      dataLoaded: true,
    });

    const result = await store.fetchProcessById(1);

    expect(result.id).toBe(1);
    expect(mock.history.get).toHaveLength(0);
  });

  test("fetchProcessById fetches processes when not loaded", async () => {
    const store = useProcessStore();

    store.$patch({
      processes: [],
      dataLoaded: false,
    });

    mock.onGet("/api/processes/").reply(200, [
      { id: 2, stages: [{ status: "En curso" }], case: { type: "Civil" }, clients: [], lawyer: { id: 1 } },
    ]);

    const result = await store.fetchProcessById(2);

    expect(result.id).toBe(2);
    expect(mock.history.get).toHaveLength(1);
  });

  test("fetchProcessById throws when process cannot be found", async () => {
    const store = useProcessStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    store.$patch({
      processes: [],
      dataLoaded: false,
    });

    mock.onGet("/api/processes/").reply(200, []);

    await expect(store.fetchProcessById(999)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("fetchProcessesData defaults to [] when response data is null", async () => {
    const store = useProcessStore();

    mock.onGet("/api/processes/").reply(200, null);

    await store.fetchProcessesData();

    expect(store.processes).toEqual([]);
    expect(store.dataLoaded).toBe(true);
  });

  test("updateProcess archives with fallback subcase when empty", async () => {
    const store = useProcessStore();

    mock.onPut("/api/update_process/101/").reply(200, {});
    mock.onGet("/api/processes/").reply(200, []);

    const activitySpy = jest
      .spyOn(activityFeed, "registerUserActivity")
      .mockResolvedValue({});

    const status = await store.updateProcess({
      processIdParam: 101,
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "",
      ref: "REF",
      authority: "Court",
      authorityEmail: "court@test.com",
      clientIds: [1],
      lawyerId: 2,
      progress: 0,
      stages: [{ status: "Fallo" }],
      caseFiles: [],
      isArchiving: true,
    });

    expect(status).toBe(200);
    expect(activitySpy).toHaveBeenCalledWith(
      activityFeed.ACTION_TYPES.FINISH,
      expect.stringContaining("legal")
    );

    activitySpy.mockRestore();
  });

  test("updateProcess finishes with fallback subcase when empty", async () => {
    const store = useProcessStore();

    mock.onPut("/api/update_process/102/").reply(200, {});
    mock.onGet("/api/processes/").reply(200, []);

    const activitySpy = jest
      .spyOn(activityFeed, "registerUserActivity")
      .mockResolvedValue({});

    const status = await store.updateProcess({
      processIdParam: 102,
      plaintiff: "Carlos",
      defendant: "Diana",
      caseTypeId: 2,
      subcase: "",
      ref: "REF",
      authority: "Court",
      authorityEmail: "court@test.com",
      clientIds: [1],
      lawyerId: 2,
      progress: 0,
      stages: [{ status: "Fallo" }],
      caseFiles: [],
      isArchiving: false,
    });

    expect(status).toBe(200);
    expect(activitySpy).toHaveBeenCalledWith(
      activityFeed.ACTION_TYPES.FINISH,
      expect.stringContaining("legal")
    );

    activitySpy.mockRestore();
  });

  test("createProcess skips upload when no files are provided", async () => {
    const store = useProcessStore();

    mock.onPost("/api/create_process/").reply(201, { id: 55 });
    mock.onGet("/api/processes/").reply(200, []);

    const uploadSpy = jest.spyOn(store, "uploadFiles");
    const activitySpy = jest
      .spyOn(activityFeed, "registerUserActivity")
      .mockResolvedValue({});

    const status = await store.createProcess({
      plaintiff: "Ana",
      defendant: "Ben",
      caseTypeId: 1,
      subcase: "Sub",
      ref: "REF",
      authority: "Court",
      authorityEmail: "court@test.com",
      clientIds: [1],
      lawyerId: 2,
      progress: 0,
      stages: [],
      caseFiles: [],
    });

    expect(status).toBe(201);
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(activitySpy).toHaveBeenCalledWith(
      activityFeed.ACTION_TYPES.CREATE,
      expect.stringContaining("Sub")
    );

    uploadSpy.mockRestore();
    activitySpy.mockRestore();
  });

  test("updateProcess edit skips warning when uploads succeed and uses fallback subcase", async () => {
    const store = useProcessStore();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    mock.onPut("/api/update_process/103/").reply(200, {});
    mock.onGet("/api/processes/").reply(200, []);

    const uploadSpy = jest
      .spyOn(store, "uploadFiles")
      .mockResolvedValue([{ success: true }]);
    const activitySpy = jest
      .spyOn(activityFeed, "registerUserActivity")
      .mockResolvedValue({});

    const status = await store.updateProcess({
      processIdParam: 103,
      plaintiff: "Eva",
      defendant: "Felipe",
      caseTypeId: 3,
      subcase: "",
      ref: "REF",
      authority: "Court",
      authorityEmail: "court@test.com",
      clientIds: [1],
      lawyerId: 2,
      progress: 0,
      stages: [{ status: "Admisión" }],
      caseFiles: [{ file: { name: "file-1" } }],
      isArchiving: false,
    });

    expect(status).toBe(200);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(activitySpy).toHaveBeenCalledWith(
      activityFeed.ACTION_TYPES.EDIT,
      expect.stringContaining("legal")
    );

    uploadSpy.mockRestore();
    activitySpy.mockRestore();
    warnSpy.mockRestore();
  });

  test("init fetches processes when dataLoaded is false", async () => {
    const store = useProcessStore();

    store.$patch({ dataLoaded: false, processes: [] });

    mock.onGet("/api/processes/").reply(200, [
      { id: 1, stages: [{ status: "En curso" }], case: { type: "Civil" }, clients: [], lawyer: { id: 1 } },
    ]);

    await store.init();

    expect(store.dataLoaded).toBe(true);
    expect(store.processes).toHaveLength(1);
    expect(store.processes[0].id).toBe(1);
  });

  test("filteredProcesses matches by stage status when other fields do not match", () => {
    const store = useProcessStore();

    store.$patch({
      processes: [
        {
          id: 1,
          plaintiff: "Alice",
          defendant: "Bob",
          authority: "X",
          ref: "R1",
          subcase: "Sub",
          case: { type: "Civil" },
          stages: [{ status: "Admisión" }],
          clients: [],
          lawyer: { id: 10 },
        },
      ],
    });

    const results = store.filteredProcesses("admisión", false, null, "open");

    expect(results.map((p) => p.id)).toEqual([1]);
  });

  test("createProcess uses fallback subcase 'legal' when subcase is empty", async () => {
    const store = useProcessStore();

    mock.onPost("/api/create_process/").reply(201, { id: 77 });
    mock.onGet("/api/processes/").reply(200, []);

    const activitySpy = jest
      .spyOn(activityFeed, "registerUserActivity")
      .mockResolvedValue({});

    const status = await store.createProcess({
      plaintiff: "Alice",
      defendant: "Bob",
      caseTypeId: 1,
      subcase: "",
      ref: "REF",
      authority: "Court",
      authorityEmail: "court@test.com",
      clientIds: [1],
      lawyerId: 2,
      progress: 0,
      stages: [],
      caseFiles: [],
    });

    expect(status).toBe(201);
    expect(activitySpy).toHaveBeenCalledWith(
      activityFeed.ACTION_TYPES.CREATE,
      expect.stringContaining("legal")
    );

    activitySpy.mockRestore();
  });
});
