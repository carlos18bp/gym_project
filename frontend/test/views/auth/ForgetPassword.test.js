import { mount } from "@vue/test-utils";
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
  default: {
    name: "VueRecaptcha",
    template:
      '<button type="button" data-testid="captcha-trigger" @click="$emit(\'verify\', \'token\')">captcha</button>',
  },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
const findButtonByText = (wrapper, text) =>
  wrapper.findAll("button").find((button) => button.text().includes(text));

const mountForgetPassword = () =>
  mount(ForgetPassword, {
    global: {
      stubs: {
        RouterLink: { template: "<a><slot /></a>" },
      },
    },
  });

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

    const wrapper = mountForgetPassword();

    await flushPromises();

    jest.useFakeTimers();

    await wrapper.find('input[type="email"]').setValue("user@test.com");
    await wrapper.get('[data-testid="captcha-trigger"]').trigger("click");
    const sendCodeButton = findButtonByText(wrapper, "Enviar código");

    expect(sendCodeButton).toBeTruthy();
    await sendCodeButton.trigger("click");

    expect(axios.post).toHaveBeenCalledWith("/api/send_passcode/", {
      email: "user@test.com",
      subject_email: "Password Reset Code",
      captcha_token: "token",
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Código de restablecimiento enviado a tu correo",
      "info"
    );
    expect(wrapper.text()).toContain("Enviar nuevo código en");

    jest.advanceTimersByTime(180000);
    await Promise.resolve();

    expect(wrapper.text()).not.toContain("Enviar nuevo código en");

    const resendButton = findButtonByText(wrapper, "Enviar código");
    expect(resendButton).toBeTruthy();
    expect(resendButton.attributes("disabled")).toBeUndefined();

    jest.useRealTimers();
  });

  test("validates and resets password", async () => {
    const axios = await import("axios");
    axios.post.mockResolvedValue({ data: {} });

    const wrapper = mountForgetPassword();

    await flushPromises();

    await wrapper.find('input[type="email"]').setValue("user@test.com");
    await wrapper.find('input[id="passcode"]').setValue("123");
    await wrapper.find('input[id="password"]').setValue("Secret123");
    await wrapper.find('input[id="confirm_password"]').setValue("Secret123");
    await wrapper.get('[data-testid="captcha-trigger"]').trigger("click");

    await wrapper.find("form").trigger("submit.prevent");

    expect(axios.post).toHaveBeenCalledWith("/api/verify_passcode_and_reset_password/", {
      passcode: 123,
      new_password: "Secret123",
      email: "user@test.com",
      captcha_token: "token",
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "¡Contraseña restablecida exitosamente!",
      "success"
    );
    expect(mockRouterPush).toHaveBeenCalledWith({ name: "sign_in" });
    expect(wrapper.find('input[type="email"]').element.value).toBe("user@test.com");
  });

  test("blocks reset when passwords mismatch", async () => {
    const axios = await import("axios");
    const wrapper = mountForgetPassword();

    await flushPromises();

    await wrapper.find('input[id="passcode"]').setValue("123");
    await wrapper.find('input[id="password"]').setValue("Secret123");
    await wrapper.find('input[id="confirm_password"]').setValue("Different");
    await wrapper.get('[data-testid="captcha-trigger"]').trigger("click");

    await wrapper.find("form").trigger("submit.prevent");

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Las contraseñas no coinciden!",
      "warning"
    );
    expect(axios.post).not.toHaveBeenCalled();
    expect(wrapper.find('input[id="confirm_password"]').element.value).toBe("Different");
  });
});
