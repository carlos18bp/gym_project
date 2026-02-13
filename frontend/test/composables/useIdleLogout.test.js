const mockGoogleLogout = jest.fn();

jest.mock("vue3-google-login", () => ({
  __esModule: true,
  googleLogout: (...args) => mockGoogleLogout(...args),
}));

import { useIdleLogout } from "@/composables/useIdleLogout";

let addListenerSpy;
let removeListenerSpy;
let setTimeoutSpy;
let clearTimeoutSpy;

describe("useIdleLogout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    addListenerSpy = jest.spyOn(window, "addEventListener");
    removeListenerSpy = jest.spyOn(window, "removeEventListener");
    setTimeoutSpy = jest.spyOn(global, "setTimeout");
    clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    mockGoogleLogout.mockReset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    addListenerSpy.mockRestore();
    removeListenerSpy.mockRestore();
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  test("throws when router or authStore are missing", () => {
    expect(() => useIdleLogout()).toThrow(
      "useIdleLogout requires both 'router' and 'authStore' instances"
    );
    expect(() => useIdleLogout({ router: {} })).toThrow();
    expect(() => useIdleLogout({ authStore: {} })).toThrow();
  });

  test("subscribe attaches listeners and does nothing when token is missing", () => {
    const router = { push: jest.fn() };
    const authStore = { token: null, logout: jest.fn() };

    const { subscribe } = useIdleLogout({ router, authStore, timeout: 500 });

    subscribe();

    expect(window.addEventListener).toHaveBeenCalledTimes(5);
    expect(global.setTimeout).toHaveBeenCalled();

    jest.advanceTimersByTime(500);

    expect(authStore.logout).not.toHaveBeenCalled();
    expect(mockGoogleLogout).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  test("subscribe resets existing timer when called again", () => {
    const router = { push: jest.fn() };
    const authStore = { token: null, logout: jest.fn() };

    const { subscribe } = useIdleLogout({ router, authStore, timeout: 500 });

    subscribe();
    subscribe();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  test("idle timeout logs out and redirects when token exists", () => {
    const router = { push: jest.fn() };
    const authStore = { token: "token", logout: jest.fn() };

    const { subscribe } = useIdleLogout({ router, authStore, timeout: 500 });

    subscribe();
    jest.advanceTimersByTime(500);

    expect(authStore.logout).toHaveBeenCalled();
    expect(mockGoogleLogout).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({ name: "sign_in" });
  });

  test("unsubscribe removes listeners and clears timer", () => {
    const router = { push: jest.fn() };
    const authStore = { token: "token", logout: jest.fn() };

    const { subscribe, unsubscribe } = useIdleLogout({ router, authStore, timeout: 500 });

    subscribe();
    unsubscribe();

    expect(window.removeEventListener).toHaveBeenCalledTimes(5);
    expect(global.clearTimeout).toHaveBeenCalled();
  });

  test("unsubscribe does not clear timer when none is set", () => {
    const router = { push: jest.fn() };
    const authStore = { token: "token", logout: jest.fn() };

    const { unsubscribe } = useIdleLogout({ router, authStore, timeout: 500 });

    unsubscribe();

    expect(clearTimeoutSpy).not.toHaveBeenCalled();
  });
});
