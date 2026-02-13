import { setActivePinia, createPinia } from "pinia";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

const mock = new AxiosMockAdapter(axios);

describe("Dynamic Document Store - Permissions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
  });

  test("fetchAvailableClients normalizes user_id to id", async () => {
    const store = useDynamicDocumentStore();

    mock.onGet("/api/dynamic-documents/permissions/clients/").reply(200, {
      clients: [
        {
          user_id: 123,
          email: "client@test.com",
          full_name: "Client Test",
          role: "client",
        },
      ],
    });

    const clients = await store.fetchAvailableClients();

    expect(clients).toEqual([
      {
        id: 123,
        user_id: 123,
        email: "client@test.com",
        full_name: "Client Test",
        role: "client",
      },
    ]);

    expect(mock.history.get).toHaveLength(1);
  });

  test("fetchAvailableClients returns empty list when response has no clients", async () => {
    const store = useDynamicDocumentStore();

    mock.onGet("/api/dynamic-documents/permissions/clients/").reply(200, {});

    const clients = await store.fetchAvailableClients();

    expect(clients).toEqual([]);
  });

  test("fetchAvailableClients throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/dynamic-documents/permissions/clients/").reply(500, { detail: "error" });

    await expect(store.fetchAvailableClients()).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("fetchDocumentPermissions fetches permissions for a document", async () => {
    const store = useDynamicDocumentStore();

    const payload = { is_public: true, visibility: { roles: [] }, usability: { roles: [] } };

    mock.onGet("/api/dynamic-documents/55/permissions/").reply(200, payload);

    const result = await store.fetchDocumentPermissions(55);

    expect(result).toEqual(payload);
    expect(mock.history.get).toHaveLength(1);
  });

  test("fetchDocumentPermissions throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/dynamic-documents/55/permissions/").reply(500, { detail: "error" });

    await expect(store.fetchDocumentPermissions(55)).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("fetchAvailableRoles returns roles from backend", async () => {
    const store = useDynamicDocumentStore();

    const roles = ["lawyer", "client"];

    mock.onGet("/api/dynamic-documents/permissions/roles/").reply(200, roles);

    const result = await store.fetchAvailableRoles();

    expect(result).toEqual(roles);
    expect(mock.history.get).toHaveLength(1);
  });

  test("fetchAvailableRoles throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/dynamic-documents/permissions/roles/").reply(500, { detail: "error" });

    await expect(store.fetchAvailableRoles()).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("manageDocumentPermissions posts data and returns response", async () => {
    const store = useDynamicDocumentStore();

    const permissionsData = {
      is_public: false,
      visibility: { roles: ["lawyer"], user_ids: [1] },
      usability: { roles: ["client"], user_ids: [2] },
    };

    mock
      .onPost("/api/dynamic-documents/77/permissions/manage/")
      .reply(200, { ok: true });

    const result = await store.manageDocumentPermissions(77, permissionsData);

    expect(result).toEqual({ ok: true });
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe("/api/dynamic-documents/77/permissions/manage/");
  });

  test("manageDocumentPermissions throws on error", async () => {
    const store = useDynamicDocumentStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/dynamic-documents/77/permissions/manage/").reply(500, { detail: "error" });

    await expect(
      store.manageDocumentPermissions(77, { is_public: true, visibility: {}, usability: {} })
    ).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });
});
