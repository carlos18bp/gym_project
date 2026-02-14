import { shallowMount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import SubscriptionSignIn from "@/views/auth/SubscriptionSignIn.vue";
import { useAuthStore } from "@/stores/auth/auth";

const mockRouterPush = jest.fn();
const mockShowNotification = jest.fn();
const mockFetchSiteKey = jest.fn();
let mockRoute;
let pinia;

jest.mock("axios", () => ({
  post: jest.fn(),
}));

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockRouterPush }),
  useRoute: () => mockRoute,
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/stores/auth/captcha", () => ({
  __esModule: true,
  useCaptchaStore: () => ({
    fetchSiteKey: (...args) => mockFetchSiteKey(...args),
  }),
}));

jest.mock("vue3-recaptcha2", () => ({
  __esModule: true,
  default: { template: "<div />" },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SubscriptionSignIn.vue", () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
    mockFetchSiteKey.mockResolvedValue("site-key");
    mockRoute = { params: {}, query: { plan: "cliente" } };
  });

  test("submits credentials and redirects to checkout", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();

    jest.spyOn(authStore, "login").mockImplementation(() => {});
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);
    jest.spyOn(authStore, "attempsSignIn").mockImplementation((action) => {
      if (action !== "initial") {
        authStore.signInTries += 1;
      }
    });

    axios.post.mockResolvedValue({ data: { access: "token", user: { id: 1 } } });

    const wrapper = shallowMount(SubscriptionSignIn, {
      global: {
        plugins: [pinia],
        mocks: {
          $route: mockRoute,
        },
        stubs: {
          GoogleLogin: { template: "<div />" },
          VueRecaptcha: { template: "<div />" },
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    await flushPromises();

    wrapper.vm.$.setupState.userForm.email = "user@test.com";
    wrapper.vm.$.setupState.userForm.password = "secret";
    await wrapper.vm.$.setupState.onCaptchaVerified("token");

    await wrapper.vm.$.setupState.signInUser();

    expect(axios.post).toHaveBeenCalledWith("/api/sign_in/", {
      email: "user@test.com",
      password: "secret",
      captcha_token: "token",
    });
    expect(authStore.login).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "¡Inicio de sesión exitoso!",
      "success"
    );
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "checkout",
      params: { plan: "cliente" },
    });
  });

  test("blocks submit when missing email", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);

    const wrapper = shallowMount(SubscriptionSignIn, {
      global: {
        plugins: [pinia],
        mocks: {
          $route: mockRoute,
        },
        stubs: {
          GoogleLogin: { template: "<div />" },
          VueRecaptcha: { template: "<div />" },
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    await flushPromises();

    await wrapper.vm.$.setupState.signInUser();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "El correo electrónico es requerido",
      "warning"
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("warns when max attempts reached", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    authStore.signInTries = 2;

    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);
    jest.spyOn(authStore, "attempsSignIn").mockImplementation((action) => {
      if (action !== "initial") {
        authStore.signInTries += 1;
      }
    });

    const wrapper = shallowMount(SubscriptionSignIn, {
      global: {
        plugins: [pinia],
        mocks: {
          $route: mockRoute,
        },
        stubs: {
          GoogleLogin: { template: "<div />" },
          VueRecaptcha: { template: "<div />" },
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    await flushPromises();

    wrapper.vm.$.setupState.userForm.email = "user@test.com";
    wrapper.vm.$.setupState.userForm.password = "secret";
    await wrapper.vm.$.setupState.onCaptchaVerified("token");

    await wrapper.vm.$.setupState.signInUser();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Has excedido el número máximo de intentos. Intenta más tarde.",
      "warning"
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("handles Google login flow", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();

    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);
    jest.spyOn(authStore, "login").mockImplementation(() => {});

    axios.post.mockResolvedValue({ data: { access: "token", user: { id: 1 } } });

    const wrapper = shallowMount(SubscriptionSignIn, {
      global: {
        plugins: [pinia],
        mocks: {
          $route: mockRoute,
        },
        stubs: {
          GoogleLogin: { template: "<div />" },
          VueRecaptcha: { template: "<div />" },
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    await flushPromises();

    await wrapper.vm.$.setupState.handleLoginWithGoogle({ credential: "token" });

    expect(axios.post).toHaveBeenCalledWith("/api/google_login/", {
      credential: "token",
    });
    expect(authStore.login).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "¡Inicio de sesión exitoso con Google!",
      "success"
    );
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "checkout",
      params: { plan: "cliente" },
    });
  });
});
