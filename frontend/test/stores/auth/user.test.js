import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useAuthStore } from "@/stores/auth/auth";
import { useUserStore } from "@/stores/auth/user";
import * as requestHttp from "@/stores/services/request_http";

const mock = new AxiosMockAdapter(axios);

describe("User Store (Auth)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    localStorage.clear();
  });

  test("getters: userById, clients, allClientTypes, clientsAndLawyers, getCurrentUser", () => {
    const store = useUserStore();

    store.$patch({
      users: [
        { id: 1, role: "client" },
        { id: 2, role: "basic" },
        { id: 3, role: "corporate_client" },
        { id: 4, role: "lawyer" },
        { id: 5, role: "admin" },
      ],
      currentUser: { id: 1, role: "client" },
    });

    expect(store.userById(2)).toEqual({ id: 2, role: "basic" });
    expect(store.userById(999)).toBeUndefined();

    expect(store.clients.map((u) => u.id)).toEqual([1]);

    expect(store.allClientTypes.map((u) => u.id)).toEqual([1, 2, 3]);

    expect(store.clientsAndLawyers.map((u) => u.id)).toEqual([1, 2, 3, 4]);

    expect(store.getCurrentUser).toEqual({ id: 1, role: "client" });
  });

  test("setCurrentUser takes userAuth from auth store when currentUser is null", () => {
    const authStore = useAuthStore();
    authStore.userAuth = { id: 1, role: "lawyer" };

    const store = useUserStore();

    store.setCurrentUser();

    expect(store.currentUser).toEqual({ id: 1, role: "lawyer" });
  });

  test("setCurrentUser does not override currentUser when already set", () => {
    const authStore = useAuthStore();
    authStore.userAuth = { id: 1, role: "lawyer" };

    const store = useUserStore();
    store.currentUser = { id: 99, role: "client" };

    const result = store.setCurrentUser();

    expect(result).toBe(null);
    expect(store.currentUser).toEqual({ id: 99, role: "client" });
  });

  test("fetchUsersData parses JSON string payload and sets users", async () => {
    const authStore = useAuthStore();
    authStore.userAuth = { id: 1, role: "lawyer" };

    const store = useUserStore();

    const users = [{ id: 1, first_name: "A", role: "lawyer" }];

    mock.onGet("/api/users/").reply(200, JSON.stringify(users));

    await store.fetchUsersData();

    expect(store.users).toEqual(users);
    expect(store.dataLoaded).toBe(true);
    expect(store.currentUser).toEqual({ id: 1, role: "lawyer" });
  });

  test("fetchUsersData handles invalid JSON string by setting users empty array", async () => {
    const authStore = useAuthStore();
    authStore.userAuth = { id: 1, role: "lawyer" };

    const store = useUserStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/users/").reply(200, "not-json");

    await store.fetchUsersData();

    expect(store.users).toEqual([]);
    expect(store.dataLoaded).toBe(true);

    consoleSpy.mockRestore();
  });

  test("fetchUsersData defaults to empty array when response data is null", async () => {
    const authStore = useAuthStore();
    authStore.userAuth = { id: 1, role: "lawyer" };

    const store = useUserStore();

    mock.onGet("/api/users/").reply(200, null);

    await store.fetchUsersData();

    expect(store.users).toEqual([]);
    expect(store.dataLoaded).toBe(true);
    expect(store.currentUser).toEqual({ id: 1, role: "lawyer" });
  });

  test("fetchUsersData handles request error by resetting state", async () => {
    const store = useUserStore();

    store.$patch({ users: [{ id: 1 }], dataLoaded: true });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/users/").networkError();

    await store.fetchUsersData();

    expect(store.users).toEqual([]);
    expect(store.dataLoaded).toBe(false);

    consoleSpy.mockRestore();
  });

  test("init fetches users and signature when dataLoaded is false", async () => {
    const authStore = useAuthStore();
    authStore.userAuth = { id: 1, role: "lawyer" };

    const store = useUserStore();

    mock.onGet("/api/users/").reply(200, [{ id: 1, role: "lawyer" }]);
    mock.onGet("/api/users/1/signature/").reply(200, { has_signature: true });

    await store.init();

    expect(store.dataLoaded).toBe(true);
    expect(store.currentUser?.id).toBe(1);
    expect(store.userSignature).toEqual({ has_signature: true });
  });

  test("init skips fetch when dataLoaded is true", async () => {
    const store = useUserStore();

    store.$patch({ dataLoaded: true });

    const fetchUsersSpy = jest.spyOn(store, "fetchUsersData").mockResolvedValue();
    const fetchSignatureSpy = jest.spyOn(store, "fetchUserSignature").mockResolvedValue();

    await store.init();

    expect(fetchUsersSpy).not.toHaveBeenCalled();
    expect(fetchSignatureSpy).not.toHaveBeenCalled();
  });

  test("filteredUsers returns clientsAndLawyers when query is empty and filters by query", () => {
    const store = useUserStore();

    store.$patch({
      users: [
        { id: 1, first_name: "Ana", last_name: "Lopez", email: "ana@test.com", identification: "1", role: "client" },
        { id: 2, first_name: "Ben", last_name: "Perez", email: "ben@test.com", identification: "2", role: "lawyer" },
        { id: 3, first_name: "Admin", last_name: "X", email: "admin@test.com", identification: "3", role: "admin" },
      ],
    });

    const noQuery = store.filteredUsers("");
    expect(noQuery.map((u) => u.id)).toEqual([1, 2]);

    const byEmail = store.filteredUsers("ben@");
    expect(byEmail.map((u) => u.id)).toEqual([2]);

    const byRole = store.filteredUsers("client");
    expect(byRole.map((u) => u.id)).toEqual([1]);
  });

  test("updateUser returns status and registers CREATE activity on first profile completion", async () => {
    const authStore = useAuthStore();
    authStore.userAuth = { id: 1, role: "lawyer" };

    const store = useUserStore();

    store.$patch({
      currentUser: { id: 1, is_profile_completed: false },
      users: [{ id: 1, is_profile_completed: false }],
      dataLoaded: true,
    });

    mock.onPut("/api/update_profile/1/").reply(200);
    mock.onGet("/api/users/").reply(200, [{ id: 1, is_profile_completed: true }]);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const status = await store.updateUser({
      id: 1,
      first_name: "A",
      last_name: "B",
      contact: "",
      identification: "",
      birthday: "",
      email: "a@b.com",
      document_type: "CC",
      photo_profile: "", // not a File
    });

    expect(status).toBe(200);
    expect(store.dataLoaded).toBe(true);

    const activityPayload = JSON.parse(mock.history.post[0].data);
    expect(activityPayload.action_type).toBe("create");
  });

  test("updateUser registers UPDATE activity on subsequent profile updates", async () => {
    const authStore = useAuthStore();
    authStore.userAuth = { id: 1, role: "lawyer" };

    const store = useUserStore();

    store.$patch({
      currentUser: { id: 1, is_profile_completed: true },
      users: [{ id: 1, is_profile_completed: true }],
      dataLoaded: true,
    });

    mock.onPut("/api/update_profile/1/").reply(200);
    mock.onGet("/api/users/").reply(200, [{ id: 1, is_profile_completed: true }]);
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const status = await store.updateUser({
      id: 1,
      first_name: "A",
      last_name: "B",
      contact: "",
      identification: "",
      birthday: "",
      email: "a@b.com",
      document_type: "CC",
      photo_profile: "",
    });

    expect(status).toBe(200);

    const activityPayload = JSON.parse(mock.history.post[0].data);
    expect(activityPayload.action_type).toBe("update");
  });

  test("updateUser appends photo_profile file and skips activity when profile incomplete", async () => {
    const store = useUserStore();

    store.$patch({
      currentUser: { id: 1, is_profile_completed: false },
      users: [{ id: 1, is_profile_completed: false }],
      dataLoaded: true,
    });

    const file = new File(["photo"], "photo.png", { type: "image/png" });

    mock.onPut("/api/update_profile/1/").reply(200);
    mock.onGet("/api/users/").reply(200, [{ id: 1, is_profile_completed: false }]);

    const status = await store.updateUser({
      id: 1,
      first_name: "A",
      last_name: "B",
      contact: "",
      identification: "",
      birthday: "",
      email: "a@b.com",
      document_type: "CC",
      photo_profile: file,
    });

    expect(status).toBe(200);
    expect(mock.history.post.length).toBe(0);

    const putData = mock.history.put[0].data;
    expect(putData instanceof FormData).toBe(true);
    expect(putData.get("photo_profile")).toBe(file);
  });

  test("updateUser returns null on request error", async () => {
    const store = useUserStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPut("/api/update_profile/1/").networkError();

    const status = await store.updateUser({
      id: 1,
      first_name: "A",
      last_name: "B",
      contact: "",
      identification: "",
      birthday: "",
      email: "a@b.com",
      document_type: "CC",
      photo_profile: "",
    });

    expect(status).toBe(null);

    consoleSpy.mockRestore();
  });

  test("getUserInfo returns null when currentUser is not set", async () => {
    const store = useUserStore();

    const result = await store.getUserInfo();

    expect(result).toBe(null);
  });

  test("getUserInfo fetches and updates currentUser and users array", async () => {
    const store = useUserStore();

    store.$patch({
      currentUser: { id: 1 },
      users: [{ id: 1, first_name: "Old" }],
    });

    mock.onGet("/api/users/1/").reply(200, { id: 1, first_name: "New" });

    const result = await store.getUserInfo();

    expect(result).toEqual({ id: 1, first_name: "New" });
    expect(store.currentUser).toEqual({ id: 1, first_name: "New" });
    expect(store.users[0]).toEqual({ id: 1, first_name: "New" });
  });

  test("getUserInfo updates currentUser even when user is not in users array", async () => {
    const store = useUserStore();

    store.$patch({
      currentUser: { id: 1 },
      users: [{ id: 2, first_name: "Other" }],
    });

    mock.onGet("/api/users/1/").reply(200, { id: 1, first_name: "Fresh" });

    const result = await store.getUserInfo();

    expect(result).toEqual({ id: 1, first_name: "Fresh" });
    expect(store.currentUser).toEqual({ id: 1, first_name: "Fresh" });
    expect(store.users).toEqual([{ id: 2, first_name: "Other" }]);
  });

  test("getUserInfo returns null when response status is not 200", async () => {
    const store = useUserStore();

    store.$patch({ currentUser: { id: 1 }, users: [{ id: 1 }] });

    mock.onGet("/api/users/1/").reply(204, {});

    const result = await store.getUserInfo();

    expect(result).toBe(null);
    expect(store.currentUser).toEqual({ id: 1 });
  });

  test("getUserInfo returns null on request error", async () => {
    const store = useUserStore();

    store.$patch({ currentUser: { id: 1 } });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/users/1/").networkError();

    const result = await store.getUserInfo();

    expect(result).toBe(null);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("fetchUsers returns users on 200 and empty array on error", async () => {
    const store = useUserStore();

    mock.onGet("/api/users/").reply(200, [{ id: 1 }]);

    const result = await store.fetchUsers();
    expect(result).toEqual([{ id: 1 }]);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mock.reset();
    mock.onGet("/api/users/").reply(500, { detail: "error" });

    const resultError = await store.fetchUsers();
    expect(resultError).toEqual([]);

    consoleSpy.mockRestore();
  });

  test("fetchUsers returns empty array when response status is not 200", async () => {
    const store = useUserStore();

    mock.onGet("/api/users/").reply(204, []);

    const result = await store.fetchUsers();

    expect(result).toEqual([]);
  });

  test("getUsersByIds fetches users when list is empty", async () => {
    const store = useUserStore();

    const fetchSpy = jest.spyOn(store, "fetchUsers").mockImplementation(async () => {
      store.users = [{ id: 1 }, { id: 2 }];
      return store.users;
    });

    const result = await store.getUsersByIds([2]);

    expect(fetchSpy).toHaveBeenCalled();
    expect(result).toEqual([{ id: 2 }]);
  });

  test("getUsersByIds uses existing users when available", async () => {
    const store = useUserStore();

    store.$patch({ users: [{ id: 1 }, { id: 2 }] });

    const fetchSpy = jest.spyOn(store, "fetchUsers");

    const result = await store.getUsersByIds([1]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });

  test("fetchUserSignature returns early when currentUser is missing", async () => {
    const store = useUserStore();

    store.$patch({ userSignature: { has_signature: true }, currentUser: null });

    await store.fetchUserSignature();

    expect(store.userSignature).toEqual({ has_signature: true });
    expect(mock.history.get.length).toBe(0);
  });

  test("fetchUserSignature sets has_signature false when response status is not 200", async () => {
    const store = useUserStore();

    store.$patch({ currentUser: { id: 1, has_signature: true } });

    mock.onGet("/api/users/1/signature/").reply(204, {});

    await store.fetchUserSignature();

    expect(store.userSignature).toEqual({ has_signature: false });
    expect(store.currentUser.has_signature).toBe(false);
  });

  test("fetchUserSignature skips currentUser update when cleared before success", async () => {
    const store = useUserStore();

    store.$patch({ currentUser: { id: 1, has_signature: false } });

    mock.onGet("/api/users/1/signature/").reply(200, { has_signature: true });

    const promise = store.fetchUserSignature();
    store.currentUser = null;
    await promise;

    expect(store.userSignature).toEqual({ has_signature: true });
    expect(store.currentUser).toBe(null);
  });

  test("fetchUserSignature skips currentUser update when cleared before non-200", async () => {
    const store = useUserStore();

    store.$patch({ currentUser: { id: 1, has_signature: true } });

    mock.onGet("/api/users/1/signature/").reply(204, {});

    const promise = store.fetchUserSignature();
    store.currentUser = null;
    await promise;

    expect(store.userSignature).toEqual({ has_signature: false });
    expect(store.currentUser).toBe(null);
  });

  test("fetchUserSignature sets has_signature false when request fails", async () => {
    const store = useUserStore();

    store.$patch({ currentUser: { id: 1, has_signature: true } });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/users/1/signature/").reply(404);

    await store.fetchUserSignature();

    expect(store.userSignature).toEqual({ has_signature: false });
    expect(store.currentUser.has_signature).toBe(false);

    consoleSpy.mockRestore();
  });

  test("fetchUserSignature skips currentUser update when cleared before error", async () => {
    const store = useUserStore();

    store.$patch({ currentUser: { id: 1, has_signature: true } });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/users/1/signature/").networkError();

    const promise = store.fetchUserSignature();
    store.currentUser = null;
    await promise;

    expect(store.userSignature).toEqual({ has_signature: false });
    expect(store.currentUser).toBe(null);

    consoleSpy.mockRestore();
  });

  test("updateUserSignature returns false for invalid params", async () => {
    const store = useUserStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const resultNoUser = await store.updateUserSignature({ formData: new FormData(), userId: null });
    expect(resultNoUser).toBe(false);

    const resultInvalidForm = await store.updateUserSignature({ formData: {}, userId: 1 });
    expect(resultInvalidForm).toBe(false);

    consoleSpy.mockRestore();
  });

  test("updateUserSignature uploads signature, refreshes signature, updates currentUser, and registers activity", async () => {
    const store = useUserStore();

    store.$patch({
      currentUser: { id: 1, has_signature: false },
      userSignature: { has_signature: false },
    });

    const formData = new FormData();
    formData.append("method", "upload");

    mock.onPost("/api/users/update_signature/1/").reply(200, { message: "ok" });
    mock.onGet("/api/users/1/signature/").reply(200, { has_signature: true });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.updateUserSignature({ formData, userId: 1 });

    expect(result).toBe(true);
    expect(store.userSignature).toEqual({ has_signature: true });
    expect(store.currentUser.has_signature).toBe(true);

    // Signature upload + activity
    expect(mock.history.post.length).toBeGreaterThanOrEqual(2);
  });

  test("updateUserSignature skips currentUser update when IDs do not match", async () => {
    const store = useUserStore();

    store.$patch({
      currentUser: { id: 2, has_signature: false },
      userSignature: { has_signature: false },
    });

    const formData = new FormData();
    formData.append("method", "upload");

    mock.onPost("/api/users/update_signature/1/").reply(200, { message: "ok" });
    mock.onGet("/api/users/2/signature/").reply(200, { has_signature: false });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.updateUserSignature({ formData, userId: 1 });

    expect(result).toBe(true);
    expect(store.currentUser).toEqual({ id: 2, has_signature: false });
  });

  test("updateUserSignature registers draw method in activity description", async () => {
    const store = useUserStore();

    store.$patch({
      currentUser: { id: 1, has_signature: false },
      userSignature: { has_signature: false },
    });

    const formData = new FormData();
    formData.append("method", "draw");

    mock.onPost("/api/users/update_signature/1/").reply(200, { message: "ok" });
    mock.onGet("/api/users/1/signature/").reply(200, { has_signature: true });
    mock.onPost("/api/create-activity/").reply(200, { id: 1 });

    const result = await store.updateUserSignature({ formData, userId: 1 });

    expect(result).toBe(true);

    const activityPayload = JSON.parse(mock.history.post[mock.history.post.length - 1].data);
    expect(activityPayload.description).toContain("drawn");
  });

  test("updateUserSignature returns false when response status is not 200/201", async () => {
    const store = useUserStore();

    store.$patch({ currentUser: { id: 1 } });

    const formData = new FormData();
    formData.append("method", "upload");

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/users/update_signature/1/").reply(202, { message: "accepted" });

    const result = await store.updateUserSignature({ formData, userId: 1 });

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("updateUserSignature returns false on upload failure", async () => {
    const store = useUserStore();

    store.$patch({ currentUser: { id: 1 } });

    const formData = new FormData();
    formData.append("method", "upload");

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/users/update_signature/1/").reply(400, { detail: "bad" });

    const result = await store.updateUserSignature({ formData, userId: 1 });

    expect(result).toBe(false);

    consoleSpy.mockRestore();
  });

  test("updateUserSignature returns false when upload throws without response", async () => {
    const store = useUserStore();

    store.$patch({ currentUser: { id: 1 } });

    const formData = new FormData();
    formData.append("method", "upload");

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const uploadSpy = jest
      .spyOn(requestHttp, "upload_file_request")
      .mockRejectedValue(new Error("boom"));

    const result = await store.updateUserSignature({ formData, userId: 1 });

    expect(result).toBe(false);

    uploadSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
