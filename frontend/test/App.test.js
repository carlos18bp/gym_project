import { mount } from "@vue/test-utils";
import { reactive, nextTick } from "vue";

const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();
const mockUseIdleLogout = jest.fn(() => ({
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
}));

jest.mock("@/composables/useIdleLogout", () => ({
  useIdleLogout: (...args) => mockUseIdleLogout(...args),
}));

let mockAuthStore;
jest.mock("@/stores/auth/auth", () => ({
  useAuthStore: () => mockAuthStore,
}));

const mockUserInit = jest.fn().mockResolvedValue(undefined);
jest.mock("@/stores/auth/user", () => ({
  useUserStore: () => ({ init: mockUserInit }),
}));

const mockRouter = { push: jest.fn() };
jest.mock("vue-router", () => ({
  RouterView: { name: "RouterView", template: "<div data-testid='router-view' />" },
  useRouter: () => mockRouter,
}));

import App from "@/App.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const mountApp = async () => {
  const wrapper = mount(App, {
    global: {
      stubs: { PWAInstallAlert: { name: "PWAInstallAlert", template: "<div />" } },
    },
  });
  await flushPromises();
  return wrapper;
};

describe("App.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthStore = reactive({
      token: null,
      isAuthenticated: jest.fn().mockResolvedValue(true),
    });
  });

  test("does not start idle logout or validate the session without a token", async () => {
    await mountApp();

    expect(mockUseIdleLogout).not.toHaveBeenCalled();
    expect(mockAuthStore.isAuthenticated).not.toHaveBeenCalled();
  });

  test("starts idle logout and initializes the user store with a valid token", async () => {
    mockAuthStore.token = "jwt";

    await mountApp();

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockUserInit).toHaveBeenCalledTimes(1);
  });

  test("configures idle logout with the 15 minute timeout, router and auth store", async () => {
    mockAuthStore.token = "jwt";

    await mountApp();

    expect(mockUseIdleLogout).toHaveBeenCalledWith({
      timeout: 15 * 60 * 1000,
      router: mockRouter,
      authStore: mockAuthStore,
    });
  });

  test("skips user store initialization when the token is invalid", async () => {
    mockAuthStore.token = "jwt";
    mockAuthStore.isAuthenticated.mockResolvedValue(false);

    await mountApp();

    expect(mockUserInit).not.toHaveBeenCalled();
  });

  test("warns and survives when token validation throws", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockAuthStore.token = "jwt";
    mockAuthStore.isAuthenticated.mockRejectedValue(new Error("expired"));

    await mountApp();

    expect(warnSpy).toHaveBeenCalledWith(
      "Token validation failed during initialization:",
      expect.any(Error)
    );
    expect(mockUserInit).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test("starts idle logout when the user logs in after mount", async () => {
    await mountApp();
    expect(mockSubscribe).not.toHaveBeenCalled();

    mockAuthStore.token = "jwt";
    await nextTick();

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  test("stops idle logout when the user logs out", async () => {
    mockAuthStore.token = "jwt";
    await mountApp();

    mockAuthStore.token = null;
    await nextTick();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test("cleans up idle logout on unmount", async () => {
    mockAuthStore.token = "jwt";
    const wrapper = await mountApp();

    wrapper.unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test("renders the router view", async () => {
    const wrapper = await mountApp();

    expect(wrapper.find("[data-testid='router-view']").exists()).toBe(true);
  });

  test("logs and survives when the idle logout controller fails to start", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockUseIdleLogout.mockImplementationOnce(() => {
      throw new Error("no listeners");
    });
    mockAuthStore.token = "jwt";

    await mountApp();

    expect(errorSpy).toHaveBeenCalledWith(
      "Error starting idle logout:",
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });

  test("logs and survives when stopping the idle logout controller fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockUnsubscribe.mockImplementationOnce(() => {
      throw new Error("already removed");
    });
    mockAuthStore.token = "jwt";
    await mountApp();

    mockAuthStore.token = null;
    await nextTick();

    expect(errorSpy).toHaveBeenCalledWith(
      "Error stopping idle logout:",
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});
