import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useLegalUpdateStore } from "@/stores/legal/legalUpdate";

const mock = new AxiosMockAdapter(axios);

describe("Legal Update Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  test("initializes with empty state", () => {
    const store = useLegalUpdateStore();

    expect(store.updates).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBe(null);
  });

  test("getters: activeUpdates, isLoading, hasError, errorMessage", () => {
    const store = useLegalUpdateStore();

    store.$patch({
      updates: [
        { id: 1, is_active: true },
        { id: 2, is_active: false },
      ],
      loading: true,
      error: "x",
    });

    expect(store.activeUpdates.map((u) => u.id)).toEqual([1]);
    expect(store.isLoading).toBe(true);
    expect(store.hasError).toBe(true);
    expect(store.errorMessage).toBe("x");
  });

  test("fetchActiveUpdates loads updates and clears error", async () => {
    const store = useLegalUpdateStore();

    mock.onGet("/api/legal-updates/active/").reply(200, [{ id: 1 }]);

    await store.fetchActiveUpdates();

    expect(store.updates).toEqual([{ id: 1 }]);
    expect(store.error).toBe(null);
    expect(store.loading).toBe(false);
  });

  test("createUpdate appends image file to FormData", async () => {
    const store = useLegalUpdateStore();

    const appendSpy = jest.fn();
    const originalFormData = global.FormData;
    global.FormData = class {
      constructor() {
        this.append = appendSpy;
      }
    };

    const file = new File(["img"], "image.png", { type: "image/png" });

    mock.onPost("/api/legal-updates/").reply(201, { id: 9, is_active: true });

    await store.createUpdate({ title: "x", image: file });

    expect(appendSpy).toHaveBeenCalledWith("image", file);
    expect(appendSpy).toHaveBeenCalledWith("title", "x");

    global.FormData = originalFormData;
  });

  test("fetchActiveUpdates sets error message on backend error", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/legal-updates/active/").reply(500, { message: "boom" });

    await store.fetchActiveUpdates();

    expect(store.error).toBe("boom");
    expect(store.loading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("deleteUpdate uses default error message when response is missing", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onDelete("/api/legal-updates/2/").networkError();

    await expect(store.deleteUpdate(2)).rejects.toBeTruthy();
    expect(store.error).toBe("Error al eliminar la actualización legal");
    expect(store.loading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("fetchActiveUpdates uses default error message when response is missing", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/legal-updates/active/").networkError();

    await store.fetchActiveUpdates();

    expect(store.error).toBe("Error al cargar las actualizaciones legales");
    expect(store.loading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("createUpdate uses default error message when response is missing", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/legal-updates/").networkError();

    await expect(store.createUpdate({ title: "x", image: null })).rejects.toBeTruthy();
    expect(store.error).toBe("Error al crear la actualización legal");
    expect(store.loading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("updateUpdate uses default error message when response is missing", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/legal-updates/4/").networkError();

    await expect(store.updateUpdate(4, { title: "x" })).rejects.toBeTruthy();
    expect(store.error).toBe("Error al actualizar la actualización legal");
    expect(store.loading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("updateUpdate uses default error message when backend message missing", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/legal-updates/4/").reply(500, {});

    await expect(store.updateUpdate(4, { title: "x" })).rejects.toBeTruthy();
    expect(store.error).toBe("Error al actualizar la actualización legal");
    expect(store.loading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("createUpdate uses default error message when backend message missing", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/legal-updates/").reply(500, {});

    await expect(store.createUpdate({ title: "x", image: null })).rejects.toBeTruthy();
    expect(store.error).toBe("Error al crear la actualización legal");
    expect(store.loading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("fetchActiveUpdates uses default error message when backend message missing", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/legal-updates/active/").reply(500, {});

    await store.fetchActiveUpdates();

    expect(store.error).toBe("Error al cargar las actualizaciones legales");
    expect(store.loading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("createUpdate unshifts update and returns data", async () => {
    const store = useLegalUpdateStore();

    mock.onPost("/api/legal-updates/").reply(201, { id: 1, is_active: true });

    const result = await store.createUpdate({ title: "x", image: null });

    expect(result.id).toBe(1);
    expect(store.updates[0].id).toBe(1);
    expect(store.error).toBe(null);
    expect(store.loading).toBe(false);
  });

  test("createUpdate sets error and rethrows on failure", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/legal-updates/").reply(500, { message: "fail" });

    await expect(store.createUpdate({ title: "x", image: null })).rejects.toBeTruthy();
    expect(store.error).toBe("fail");
    expect(store.loading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("updateUpdate replaces element in updates", async () => {
    const store = useLegalUpdateStore();

    store.updates = [{ id: 1, title: "a" }];

    mock.onPut("/api/legal-updates/1/").reply(200, { id: 1, title: "b" });

    const result = await store.updateUpdate(1, { title: "b" });

    expect(result.title).toBe("b");
    expect(store.updates[0].title).toBe("b");
    expect(store.error).toBe(null);
  });

  test("updateUpdate appends image file to FormData", async () => {
    const store = useLegalUpdateStore();

    const appendSpy = jest.fn();
    const originalFormData = global.FormData;
    global.FormData = class {
      constructor() {
        this.append = appendSpy;
      }
    };

    const file = new File(["img"], "image.png", { type: "image/png" });

    mock.onPut("/api/legal-updates/2/").reply(200, { id: 2, title: "b" });

    await store.updateUpdate(2, { title: "b", image: file });

    expect(appendSpy).toHaveBeenCalledWith("image", file);
    expect(appendSpy).toHaveBeenCalledWith("title", "b");

    global.FormData = originalFormData;
  });

  test("updateUpdate sets error and rethrows on failure", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/legal-updates/3/").reply(500, { message: "fail" });

    await expect(store.updateUpdate(3, { title: "x" })).rejects.toBeTruthy();
    expect(store.error).toBe("fail");
    expect(store.loading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("deleteUpdate removes update from list", async () => {
    const store = useLegalUpdateStore();

    store.updates = [{ id: 1 }, { id: 2 }];

    mock.onDelete("/api/legal-updates/1/").reply(204);

    await store.deleteUpdate(1);

    expect(store.updates.map((u) => u.id)).toEqual([2]);
    expect(store.error).toBe(null);
  });

  test("deleteUpdate sets error and rethrows on failure", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onDelete("/api/legal-updates/1/").reply(500, { message: "no" });

    await expect(store.deleteUpdate(1)).rejects.toBeTruthy();
    expect(store.error).toBe("no");

    consoleSpy.mockRestore();
  });

  test("deleteUpdate uses default error message when backend message missing", async () => {
    const store = useLegalUpdateStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onDelete("/api/legal-updates/2/").reply(500, {});

    await expect(store.deleteUpdate(2)).rejects.toBeTruthy();
    expect(store.error).toBe("Error al eliminar la actualización legal");
    expect(store.loading).toBe(false);

    consoleSpy.mockRestore();
  });
});
