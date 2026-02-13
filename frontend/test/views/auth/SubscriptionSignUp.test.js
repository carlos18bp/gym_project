import { shallowMount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import SubscriptionSignUp from "@/views/auth/SubscriptionSignUp.vue";
import { useAuthStore } from "@/stores/auth/auth";

const mockRouterPush = jest.fn();
const mockShowNotification = jest.fn();
const mockFetchSiteKey = jest.fn();

let mockRoute;

jest.mock("axios", () => ({
  post: jest.fn(),
}));

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({ push: mockRouterPush }),
  useRoute: () => mockRoute,
  RouterLink: { name: "RouterLink", template: "<a><slot /></a>" },
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

describe("SubscriptionSignUp.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    mockFetchSiteKey.mockResolvedValue("site-key");
    mockRoute = { params: {}, query: { plan: "cliente" } };
  });

  test("sends verification passcode", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);

    axios.post.mockResolvedValue({ data: { passcode: "111" } });

    const wrapper = shallowMount(SubscriptionSignUp, {
      global: {
        plugins: [authStore.$pinia],
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
    wrapper.vm.$.setupState.userForm.firstName = "Ana";
    wrapper.vm.$.setupState.userForm.lastName = "Lopez";
    wrapper.vm.$.setupState.userForm.password = "Secret123";
    wrapper.vm.$.setupState.userForm.confirmPassword = "Secret123";
    wrapper.vm.$.setupState.privacyAccepted = true;
    await wrapper.vm.$.setupState.onCaptchaVerified("token");

    await wrapper.vm.$.setupState.sendVerificationPasscode();

    expect(axios.post).toHaveBeenCalledWith("/api/sign_on/send_verification_code/", {
      email: "user@test.com",
      captcha_token: "token",
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Se ha enviado un código de acceso a tu correo electrónico",
      "info"
    );
    expect(wrapper.vm.$.setupState.passcodeSent).toBe("111");
  });

  test("creates account when passcode matches", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();

    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);
    jest.spyOn(authStore, "login").mockImplementation(() => {});

    axios.post.mockResolvedValue({ data: { access: "token", user: { id: 1 } } });

    const wrapper = shallowMount(SubscriptionSignUp, {
      global: {
        plugins: [authStore.$pinia],
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
    wrapper.vm.$.setupState.userForm.firstName = "Ana";
    wrapper.vm.$.setupState.userForm.lastName = "Lopez";
    wrapper.vm.$.setupState.userForm.password = "Secret123";
    wrapper.vm.$.setupState.userForm.confirmPassword = "Secret123";
    wrapper.vm.$.setupState.passcodeSent = "999";
    wrapper.vm.$.setupState.passcode = "999";
    wrapper.vm.$.setupState.emailUsedToSentPasscode = "user@test.com";
    await wrapper.vm.$.setupState.onCaptchaVerified("token");

    await wrapper.vm.$.setupState.signOnUser();

    expect(axios.post).toHaveBeenCalledWith("/api/sign_on/", {
      email: "user@test.com",
      password: "Secret123",
      first_name: "Ana",
      last_name: "Lopez",
      passcode: "999",
      captcha_token: "token",
    });
    expect(authStore.login).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith("¡Registro exitoso!", "success");
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "checkout",
      params: { plan: "cliente" },
    });
  });

  test("warns when passcode mismatches", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);

    const wrapper = shallowMount(SubscriptionSignUp, {
      global: {
        plugins: [authStore.$pinia],
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
    wrapper.vm.$.setupState.userForm.firstName = "Ana";
    wrapper.vm.$.setupState.userForm.lastName = "Lopez";
    wrapper.vm.$.setupState.userForm.password = "Secret123";
    wrapper.vm.$.setupState.userForm.confirmPassword = "Secret123";
    wrapper.vm.$.setupState.passcodeSent = "999";
    wrapper.vm.$.setupState.passcode = "123";
    wrapper.vm.$.setupState.emailUsedToSentPasscode = "user@test.com";
    await wrapper.vm.$.setupState.onCaptchaVerified("token");

    await wrapper.vm.$.setupState.signOnUser();

    expect(mockShowNotification).toHaveBeenCalledWith("El código no es válido", "warning");
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("throws validation error when email missing", async () => {
    const authStore = useAuthStore();
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);

    const wrapper = shallowMount(SubscriptionSignUp, {
      global: {
        plugins: [authStore.$pinia],
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

    await expect(wrapper.vm.$.setupState.sendVerificationPasscode()).rejects.toThrow(
      "Email required"
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      "El correo electrónico es obligatorio",
      "warning"
    );
  });

  test("handles Google sign up", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();

    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);
    jest.spyOn(authStore, "login").mockImplementation(() => {});

    axios.post.mockResolvedValue({ data: { access: "token", user: { id: 1 } } });

    const wrapper = shallowMount(SubscriptionSignUp, {
      global: {
        plugins: [authStore.$pinia],
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
      "¡Registro exitoso con Google!",
      "success"
    );
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "checkout",
      params: { plan: "cliente" },
    });
  });
});
