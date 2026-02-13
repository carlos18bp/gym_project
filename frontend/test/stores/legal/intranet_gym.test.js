import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useIntranetGymStore } from "@/stores/legal/intranet_gym";

const mock = new AxiosMockAdapter(axios);

describe("Intranet GYM Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  test("initializes with default state", () => {
    const store = useIntranetGymStore();

    expect(store.legalDocuments).toEqual([]);
    expect(store.profile).toEqual({ cover_image_url: "", profile_image_url: "" });
    expect(store.lawyers_count).toBe(0);
    expect(store.users_count).toBe(0);
    expect(store.dataLoaded).toBe(false);
  });

  test("fetchLegalDocuments loads documents and profile data", async () => {
    const store = useIntranetGymStore();

    mock.onGet("/api/list_legal_intranet_documents/").reply(200, {
      documents: [{ id: 1 }],
      profile: { cover_image_url: "c", profile_image_url: "p" },
      lawyers_count: 2,
      users_count: 3,
    });

    await store.fetchLegalDocuments();

    expect(store.legalDocuments).toEqual([{ id: 1 }]);
    expect(store.profile).toEqual({ cover_image_url: "c", profile_image_url: "p" });
    expect(store.lawyers_count).toBe(2);
    expect(store.users_count).toBe(3);
    expect(store.dataLoaded).toBe(true);
  });

  test("fetchLegalDocuments uses defaults when response lacks profile/counts", async () => {
    const store = useIntranetGymStore();

    mock.onGet("/api/list_legal_intranet_documents/").reply(200, {
      documents: [{ id: 1 }],
    });

    await store.fetchLegalDocuments();

    expect(store.legalDocuments).toEqual([{ id: 1 }]);
    expect(store.profile).toEqual({ cover_image_url: "", profile_image_url: "" });
    expect(store.lawyers_count).toBe(0);
    expect(store.users_count).toBe(0);
    expect(store.dataLoaded).toBe(true);
  });

  test("fetchLegalDocuments defaults documents when response lacks documents", async () => {
    const store = useIntranetGymStore();

    mock.onGet("/api/list_legal_intranet_documents/").reply(200, {
      profile: { cover_image_url: "c", profile_image_url: "p" },
      lawyers_count: 1,
      users_count: 2,
    });

    await store.fetchLegalDocuments();

    expect(store.legalDocuments).toEqual([]);
    expect(store.profile).toEqual({ cover_image_url: "c", profile_image_url: "p" });
    expect(store.lawyers_count).toBe(1);
    expect(store.users_count).toBe(2);
    expect(store.dataLoaded).toBe(true);
  });

  test("fetchLegalDocuments handles backend error by resetting state", async () => {
    const store = useIntranetGymStore();

    store.$patch({
      legalDocuments: [{ id: 99 }],
      profile: { cover_image_url: "x", profile_image_url: "y" },
      lawyers_count: 10,
      users_count: 10,
      dataLoaded: true,
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/list_legal_intranet_documents/").reply(500, { detail: "err" });

    await store.fetchLegalDocuments();

    expect(store.legalDocuments).toEqual([]);
    expect(store.profile).toEqual({ cover_image_url: "", profile_image_url: "" });
    expect(store.lawyers_count).toBe(0);
    expect(store.users_count).toBe(0);
    expect(store.dataLoaded).toBe(false);

    consoleSpy.mockRestore();
  });

  test("createReportRequest returns 201 on success and registers activity", async () => {
    const store = useIntranetGymStore();

    mock.onPost("/api/create_report_request/").reply(201, { ok: true });
    mock.onPost("/api/create-activity/").reply(200, {
      id: 1,
      action_type: "create",
      description: "x",
      created_at: "2026-01-01T00:00:00Z",
    });

    const status = await store.createReportRequest({
      document: "123",
      initialDate: "2026-01-01",
      endDate: "2026-01-31",
      paymentConcept: "Honorarios",
      paymentAmount: "100000",
      userName: "A",
      userLastName: "B",
      userEmail: "a@b.com",
      files: [new File(["x"], "file.txt")],
    });

    expect(status).toBe(201);
    expect(store.dataLoaded).toBe(false);

    expect(mock.history.post.some((r) => r.url === "/api/create_report_request/")).toBe(true);
    expect(mock.history.post.some((r) => r.url === "/api/create-activity/")).toBe(true);
  });

  test("createReportRequest returns null on non-201 response", async () => {
    const store = useIntranetGymStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/create_report_request/").reply(200, { ok: true });

    const status = await store.createReportRequest({
      document: "123",
      initialDate: "2026-01-01",
      endDate: "2026-01-31",
      paymentConcept: "Honorarios",
      paymentAmount: "100000",
      userName: "A",
      userLastName: "B",
      userEmail: "a@b.com",
      files: [],
    });

    expect(status).toBe(null);

    consoleSpy.mockRestore();
  });

  test("createReportRequest returns null on error", async () => {
    const store = useIntranetGymStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/create_report_request/").reply(500, { detail: "err" });

    const status = await store.createReportRequest({
      document: "123",
      initialDate: "2026-01-01",
      endDate: "2026-01-31",
      paymentConcept: "Honorarios",
      paymentAmount: "100000",
      userName: "A",
      userLastName: "B",
      userEmail: "a@b.com",
      files: [],
    });

    expect(status).toBe(null);

    consoleSpy.mockRestore();
  });

  test("init() calls fetchLegalDocuments when dataLoaded is false", async () => {
    const store = useIntranetGymStore();

    mock.onGet("/api/list_legal_intranet_documents/").reply(200, {
      documents: [{ id: 1 }],
      profile: { cover_image_url: "c", profile_image_url: "p" },
      lawyers_count: 2,
      users_count: 3,
    });

    expect(store.dataLoaded).toBe(false);

    await store.init();

    expect(store.dataLoaded).toBe(true);
    expect(store.legalDocuments).toEqual([{ id: 1 }]);
  });

  test("init() does not call fetchLegalDocuments when dataLoaded is true", async () => {
    const store = useIntranetGymStore();

    store.$patch({
      dataLoaded: true,
      legalDocuments: [{ id: 99 }],
    });

    mock.onGet("/api/list_legal_intranet_documents/").reply(200, {
      documents: [{ id: 1 }],
      profile: {},
      lawyers_count: 0,
      users_count: 0,
    });

    await store.init();

    expect(store.legalDocuments).toEqual([{ id: 99 }]);
    expect(mock.history.get.length).toBe(0);
  });
});
