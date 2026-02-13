import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useCaseTypeStore } from "@/stores/legal/case_type";

const mock = new AxiosMockAdapter(axios);

describe("Case Type Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  test("initializes with empty state", () => {
    const store = useCaseTypeStore();

    expect(store.caseTypes).toEqual([]);
    expect(store.dataLoaded).toBe(false);
  });

  test("getter: caseTypeById", () => {
    const store = useCaseTypeStore();
    store.caseTypes = [{ id: 1, name: "x" }];

    expect(store.caseTypeById(1)).toEqual({ id: 1, name: "x" });
    expect(store.caseTypeById(999)).toBeUndefined();
  });

  test("fetchCaseTypesData loads and marks dataLoaded", async () => {
    const store = useCaseTypeStore();

    mock.onGet("/api/case_types/").reply(200, [{ id: 1 }]);

    await store.fetchCaseTypesData();

    expect(store.caseTypes).toEqual([{ id: 1 }]);
    expect(store.dataLoaded).toBe(true);
  });

  test("fetchCaseTypesData defaults to [] when response data is null", async () => {
    const store = useCaseTypeStore();

    mock.onGet("/api/case_types/").reply(200, null);

    await store.fetchCaseTypesData();

    expect(store.caseTypes).toEqual([]);
    expect(store.dataLoaded).toBe(true);
  });

  test("fetchCaseTypesData parses JSON string response", async () => {
    const store = useCaseTypeStore();

    mock.onGet("/api/case_types/").reply(200, JSON.stringify([{ id: 1 }]));

    await store.fetchCaseTypesData();

    expect(store.caseTypes).toEqual([{ id: 1 }]);
    expect(store.dataLoaded).toBe(true);
  });

  test("fetchCaseTypesData handles invalid JSON string", async () => {
    const store = useCaseTypeStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/case_types/").reply(200, "not-json");

    await store.fetchCaseTypesData();

    expect(store.caseTypes).toEqual([]);
    expect(store.dataLoaded).toBe(true);

    consoleSpy.mockRestore();
  });

  test("fetchCaseTypesData handles backend error", async () => {
    const store = useCaseTypeStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/case_types/").reply(500, { detail: "err" });

    await store.fetchCaseTypesData();

    expect(store.caseTypes).toEqual([]);
    expect(store.dataLoaded).toBe(false);

    consoleSpy.mockRestore();
  });

  test("init calls fetchCaseTypesData only when not loaded", async () => {
    const store = useCaseTypeStore();

    const spy = jest.spyOn(store, "fetchCaseTypesData").mockResolvedValue();

    await store.init();
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockClear();
    store.dataLoaded = true;

    await store.init();
    expect(spy).not.toHaveBeenCalled();
  });
});
