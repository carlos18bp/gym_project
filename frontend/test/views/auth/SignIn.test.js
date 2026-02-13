import { shallowMount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import SignIn from "@/views/auth/SignIn.vue";
import { useAuthStore } from "@/stores/auth/auth";

const mockRouterPush = jest.fn();
const mockLoginWithGoogle = jest.fn();
const mockShowNotification = jest.fn();
const mockFetchSiteKey = jest.fn();

jest.mock("axios", () => ({
  post: jest.fn(),
}));

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockRouterPush }),
  RouterLink: { name: "RouterLink", template: "<a><slot /></a>" },
}));

jest.mock("@/shared/login_with_google", () => ({
  __esModule: true,
  loginWithGoogle: (...args) => mockLoginWithGoogle(...args),
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

describe("SignIn.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    mockFetchSiteKey.mockResolvedValue("site-key");
  });

  test("submits credentials and redirects on success", async () => {
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

    const wrapper = shallowMount(SignIn, {
      global: {
        plugins: [authStore.$pinia],
        stubs: {
          GoogleLogin: { template: "<div />" },
          VueRecaptcha: { template: "<div />" },
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    await flushPromises();

    const originalLocation = window.location;
    delete window.location;
    window.location = { href: "" };

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
    expect(window.location.href).toBe("/dashboard");
    expect(wrapper.vm.$.setupState.userForm.password).toBe("");

    window.location = originalLocation;
  });

  test("blocks submit when fields are missing", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);

    const wrapper = shallowMount(SignIn, {
      global: {
        plugins: [authStore.$pinia],
        stubs: {
          GoogleLogin: { template: "<div />" },
          VueRecaptcha: { template: "<div />" },
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    await flushPromises();

    await wrapper.vm.$.setupState.signInUser();

    expect(mockShowNotification).toHaveBeenCalledWith("Email is required!", "warning");
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("warns when attempts reach the limit", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    authStore.signInTries = 2;

    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);
    jest.spyOn(authStore, "attempsSignIn").mockImplementation((action) => {
      if (action !== "initial") {
        authStore.signInTries += 1;
      }
    });

    const wrapper = shallowMount(SignIn, {
      global: {
        plugins: [authStore.$pinia],
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
      "You have exceeded the maximum number of attempts. Please try again later.",
      "warning"
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("delegates Google login handler", async () => {
    const authStore = useAuthStore();
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);

    const wrapper = shallowMount(SignIn, {
      global: {
        plugins: [authStore.$pinia],
        stubs: {
          GoogleLogin: { template: "<div />" },
          VueRecaptcha: { template: "<div />" },
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    await flushPromises();

    wrapper.vm.$.setupState.handleLoginWithGoogle({ credential: "token" });

    expect(mockLoginWithGoogle).toHaveBeenCalledWith(
      { credential: "token" },
      expect.any(Object),
      authStore
    );
  });
});
