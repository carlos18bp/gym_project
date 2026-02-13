import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useAuthStore } from "@/stores/auth/auth";
import { useProcessStore } from "@/stores/process";
import { useUserStore } from "@/stores/auth/user";

const mock = new AxiosMockAdapter(axios);

describe("Auth Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    localStorage.clear();
    delete axios.defaults.headers.common["Authorization"];
    jest.clearAllMocks();
  });

  test("initializes token and userAuth from localStorage", () => {
    localStorage.setItem("token", "tkn");
    localStorage.setItem("userAuth", JSON.stringify({ id: 1, role: "lawyer" }));

    const store = useAuthStore();

    expect(store.token).toBe("tkn");
    expect(store.userAuth).toEqual({ id: 1, role: "lawyer" });
  });

  test("login sets token, userAuth, axios Authorization header, and saves to localStorage", () => {
    const store = useAuthStore();

    store.login({ access: "abc", user: { id: 99, role: "lawyer" } });

    expect(store.token).toBe("abc");
    expect(store.userAuth).toEqual({ id: 99, role: "lawyer" });
    expect(axios.defaults.headers.common["Authorization"]).toBe("Bearer abc");

    expect(localStorage.getItem("token")).toBe("abc");
    expect(JSON.parse(localStorage.getItem("userAuth"))).toEqual({ id: 99, role: "lawyer" });
  });

  test("login clears axios Authorization header when token is missing", () => {
    const store = useAuthStore();

    axios.defaults.headers.common["Authorization"] = "Bearer old";

    store.login({ access: null, user: { id: 1 } });

    expect(axios.defaults.headers.common["Authorization"]).toBeUndefined();
  });

  test("logout clears token/userAuth, removes Authorization header, clears localStorage, and resets other stores", () => {
    const authStore = useAuthStore();
    const processStore = useProcessStore();
    const userStore = useUserStore();

    authStore.token = "abc";
    authStore.userAuth = { id: 1 };
    axios.defaults.headers.common["Authorization"] = "Bearer abc";

    localStorage.setItem("token", "abc");
    localStorage.setItem("userAuth", JSON.stringify({ id: 1 }));
    localStorage.setItem("signInTries", "3");
    localStorage.setItem("signInSecondsRemaining", "60");
    localStorage.setItem("signInSecondsAcumulated", "60");

    const resetProcessSpy = jest.spyOn(processStore, "$reset");
    const resetUserSpy = jest.spyOn(userStore, "$reset");

    authStore.logout();

    expect(authStore.token).toBe(null);
    expect(authStore.userAuth).toEqual({});
    expect(axios.defaults.headers.common["Authorization"]).toBeUndefined();

    expect(localStorage.getItem("token")).toBe(null);
    expect(localStorage.getItem("userAuth")).toBe(null);
    expect(localStorage.getItem("signInTries")).toBe("0");
    expect(localStorage.getItem("signInSecondsRemaining")).toBe("0");
    expect(localStorage.getItem("signInSecondsAcumulated")).toBe("0");

    expect(resetProcessSpy).toHaveBeenCalled();
    expect(resetUserSpy).toHaveBeenCalled();
  });

  test("removeFromLocalStorage clears running sign-in interval", () => {
    jest.useFakeTimers();

    const store = useAuthStore();

    store.signInIntervalId = setInterval(() => {}, 1000);
    localStorage.setItem("signInIntervalId", store.signInIntervalId);

    store.removeFromLocalStorage();

    expect(store.signInIntervalId).toBe(null);
    expect(localStorage.getItem("signInIntervalId")).toBe("null");

    jest.useRealTimers();
  });

  test("attempsSignIn does not increment tries for initial action", () => {
    jest.useFakeTimers();

    const store = useAuthStore();

    store.attempsSignIn("initial");

    expect(store.signInTries).toBe(0);
    expect(store.signInSecondsRemaining).toBe(0);
    expect(store.signInSecondsAcumulated).toBe(0);
    expect(localStorage.getItem("signInTries")).toBe("0");

    jest.advanceTimersByTime(1000);

    expect(store.signInIntervalId).toBe(null);
    expect(localStorage.getItem("signInIntervalId")).toBe("null");

    jest.useRealTimers();
  });

  test("validateToken returns true when backend validates token", async () => {
    const store = useAuthStore();
    store.token = "abc";
    store.userAuth = { id: 1 };

    mock.onGet("/api/validate_token/").reply(200, { ok: true });

    const result = await store.validateToken();

    expect(result).toBe(true);
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].url).toBe("/api/validate_token/");
  });

  test("validateToken returns false and triggers logout on 401", async () => {
    const store = useAuthStore();

    const logoutSpy = jest.spyOn(store, "logout").mockImplementation(() => {});
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/validate_token/").reply(401, { detail: "unauthorized" });

    const result = await store.validateToken();

    expect(result).toBe(false);
    expect(logoutSpy).toHaveBeenCalled();

    logoutSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test("validateToken returns false and triggers logout on 403", async () => {
    const store = useAuthStore();

    const logoutSpy = jest.spyOn(store, "logout").mockImplementation(() => {});
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/validate_token/").reply(403, { detail: "forbidden" });

    const result = await store.validateToken();

    expect(result).toBe(false);
    expect(logoutSpy).toHaveBeenCalled();

    logoutSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test("validateToken returns false and does not logout on non-auth errors", async () => {
    const store = useAuthStore();

    const logoutSpy = jest.spyOn(store, "logout").mockImplementation(() => {});
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/validate_token/").reply(500, { detail: "server" });

    const result = await store.validateToken();

    expect(result).toBe(false);
    expect(logoutSpy).not.toHaveBeenCalled();

    logoutSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  test("isAuthenticated returns false if token is missing", async () => {
    const store = useAuthStore();

    store.token = null;
    store.userAuth = { id: 1 };

    const result = await store.isAuthenticated();

    expect(result).toBe(false);
  });

  test("isAuthenticated returns false if userAuth.id is missing", async () => {
    const store = useAuthStore();

    store.token = "abc";
    store.userAuth = {};

    const result = await store.isAuthenticated();

    expect(result).toBe(false);
  });

  test("isAuthenticated delegates to validateToken when token and user are present", async () => {
    const store = useAuthStore();

    store.token = "abc";
    store.userAuth = { id: 1 };

    const validateSpy = jest.spyOn(store, "validateToken").mockResolvedValue(true);

    const result = await store.isAuthenticated();

    expect(result).toBe(true);
    expect(validateSpy).toHaveBeenCalled();
  });

  test("attempsSignIn increases tries and starts 60s cooldown on 3rd try", () => {
    jest.useFakeTimers();

    const store = useAuthStore();

    store.attempsSignIn("error");
    store.attempsSignIn("error");
    store.attempsSignIn("error");

    expect(store.signInTries).toBe(3);
    expect(store.signInSecondsRemaining).toBe(60);
    expect(store.signInSecondsAcumulated).toBe(60);

    expect(localStorage.getItem("signInTries")).toBe("3");
    expect(localStorage.getItem("signInSecondsRemaining")).toBe("60");
    expect(localStorage.getItem("signInSecondsAcumulated")).toBe("60");

    jest.advanceTimersByTime(1000);

    expect(store.signInSecondsRemaining).toBe(59);

    jest.useRealTimers();
  });

  test("attempsSignIn doubles cooldown duration on 6th try", () => {
    jest.useFakeTimers();

    const store = useAuthStore();

    // 3 tries => 60s
    store.attempsSignIn("error");
    store.attempsSignIn("error");
    store.attempsSignIn("error");

    // 6 tries => 120s
    store.attempsSignIn("error");
    store.attempsSignIn("error");
    store.attempsSignIn("error");

    expect(store.signInTries).toBe(6);
    expect(store.signInSecondsAcumulated).toBe(120);
    expect(store.signInSecondsRemaining).toBe(120);

    jest.useRealTimers();
  });

  test("attempsSignIn clears interval when remaining seconds reach zero", () => {
    jest.useFakeTimers();

    const store = useAuthStore();

    store.attempsSignIn("error");
    store.attempsSignIn("error");
    store.attempsSignIn("error");

    store.signInSecondsRemaining = 1;

    jest.advanceTimersByTime(1000);

    expect(store.signInIntervalId).toBe(null);
    expect(localStorage.getItem("signInIntervalId")).toBe("null");

    jest.useRealTimers();
  });
});
