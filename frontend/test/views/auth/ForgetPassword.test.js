import { shallowMount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import ForgetPassword from "@/views/auth/ForgetPassword.vue";

const mockRouterPush = jest.fn();
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

describe("ForgetPassword.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
    localStorage.clear();
    mockFetchSiteKey.mockResolvedValue("site-key");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("requests passcode and starts timer", async () => {
    const axios = await import("axios");
    axios.post.mockResolvedValue({ data: {} });

    const wrapper = shallowMount(ForgetPassword, {
      global: {
        stubs: {
          VueRecaptcha: { template: "<div />" },
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    await flushPromises();

    jest.useFakeTimers();

    wrapper.vm.$.setupState.email = "user@test.com";
    await wrapper.vm.$.setupState.onCaptchaVerified("token");

    await wrapper.vm.$.setupState.handleRequestPasswordReset();

    expect(axios.post).toHaveBeenCalledWith("/api/send_passcode/", {
      email: "user@test.com",
      subject_email: "Password Reset Code",
      captcha_token: "token",
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Código de restablecimiento enviado a tu correo",
      "info"
    );
    expect(wrapper.vm.$.setupState.timer).toBeGreaterThan(0);

    jest.advanceTimersByTime(180000);
    expect(wrapper.vm.$.setupState.isButtonDisabled).toBe(false);
  });

  test("validates and resets password", async () => {
    const axios = await import("axios");
    axios.post.mockResolvedValue({ data: {} });

    const wrapper = shallowMount(ForgetPassword, {
      global: {
        stubs: {
          VueRecaptcha: { template: "<div />" },
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    await flushPromises();

    wrapper.vm.$.setupState.email = "user@test.com";
    wrapper.vm.$.setupState.passcode = "123";
    wrapper.vm.$.setupState.newPassword = "Secret123";
    wrapper.vm.$.setupState.confirmPassword = "Secret123";
    await wrapper.vm.$.setupState.onCaptchaVerified("token");

    await wrapper.vm.$.setupState.handleResetPassword();

    expect(axios.post).toHaveBeenCalledWith("/api/verify_passcode_and_reset_password/", {
      passcode: "123",
      new_password: "Secret123",
      email: "user@test.com",
      captcha_token: "token",
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "¡Contraseña restablecida exitosamente!",
      "success"
    );
    expect(mockRouterPush).toHaveBeenCalledWith({ name: "sign_in" });
  });

  test("blocks reset when passwords mismatch", async () => {
    const axios = await import("axios");
    const wrapper = shallowMount(ForgetPassword, {
      global: {
        stubs: {
          VueRecaptcha: { template: "<div />" },
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });

    await flushPromises();

    wrapper.vm.$.setupState.passcode = "123";
    wrapper.vm.$.setupState.newPassword = "Secret123";
    wrapper.vm.$.setupState.confirmPassword = "Different";
    await wrapper.vm.$.setupState.onCaptchaVerified("token");

    await wrapper.vm.$.setupState.handleResetPassword();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Las contraseñas no coinciden!",
      "warning"
    );
    expect(axios.post).not.toHaveBeenCalled();
  });
});
