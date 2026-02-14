import { shallowMount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import SignOn from "@/views/auth/SignOn.vue";
import { useAuthStore } from "@/stores/auth/auth";

const mockRouterPush = jest.fn();
const mockLoginWithGoogle = jest.fn();
const mockShowNotification = jest.fn();
const mockFetchSiteKey = jest.fn();

jest.mock("axios", () => ({
  post: jest.fn(),
}));

jest.mock("@/router", () => ({
  __esModule: true,
  default: {
    push: (...args) => mockRouterPush(...args),
  },
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

describe("SignOn.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    mockFetchSiteKey.mockResolvedValue("site-key");
  });

  test("sends verification passcode when form is valid", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);

    axios.post.mockResolvedValue({ data: { passcode: "123" } });

    const wrapper = shallowMount(SignOn, {
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
    wrapper.vm.$.setupState.userForm.firstName = "Ana";
    wrapper.vm.$.setupState.userForm.lastName = "Lopez";
    wrapper.vm.$.setupState.userForm.password = "secret";
    wrapper.vm.$.setupState.userForm.confirmPassword = "secret";
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
    expect(wrapper.vm.$.setupState.passcodeSent).toBe(true);
  });

  test("completes sign on when passcode matches", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();

    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);
    jest.spyOn(authStore, "login").mockImplementation(() => {});

    axios.post.mockResolvedValue({ data: { access: "token", user: { id: 1 } } });

    const wrapper = shallowMount(SignOn, {
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
    wrapper.vm.$.setupState.userForm.confirmPassword = "secret";
    wrapper.vm.$.setupState.userForm.firstName = "Ana";
    wrapper.vm.$.setupState.userForm.lastName = "Lopez";
    wrapper.vm.$.setupState.passcodeSent = "123";
    wrapper.vm.$.setupState.passcode = "123";
    wrapper.vm.$.setupState.emailUsedToSentPasscode = "user@test.com";
    await wrapper.vm.$.setupState.onCaptchaVerified("token");

    await wrapper.vm.$.setupState.signOnUser();

    expect(axios.post).toHaveBeenCalledWith("/api/sign_on/", {
      email: "user@test.com",
      password: "secret",
      first_name: "Ana",
      last_name: "Lopez",
      passcode: "123",
      captcha_token: "token",
    });
    expect(authStore.login).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith("¡Registro exitoso!", "success");
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "dashboard",
      params: { user_id: "", display: "" },
    });
  });

  test("rejects sign on when passcode is empty", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);

    const wrapper = shallowMount(SignOn, {
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
    wrapper.vm.$.setupState.userForm.firstName = "Ana";
    wrapper.vm.$.setupState.userForm.lastName = "Lopez";
    wrapper.vm.$.setupState.userForm.password = "secret";
    wrapper.vm.$.setupState.userForm.confirmPassword = "secret";
    wrapper.vm.$.setupState.passcodeSent = true;
    wrapper.vm.$.setupState.passcode = "";
    wrapper.vm.$.setupState.emailUsedToSentPasscode = "user@test.com";
    await wrapper.vm.$.setupState.onCaptchaVerified("token");

    await wrapper.vm.$.setupState.signOnUser();

    expect(mockShowNotification).toHaveBeenCalledWith("El código de verificación es obligatorio", "warning");
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("delegates Google login handler", async () => {
    const authStore = useAuthStore();
    jest.spyOn(authStore, "isAuthenticated").mockResolvedValue(false);

    const wrapper = shallowMount(SignOn, {
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
