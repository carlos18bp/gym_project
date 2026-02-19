import { mount } from "@vue/test-utils";
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
  default: {
    template:
      "<button data-test='captcha' @click=\"$emit('verify', 'token')\">Captcha</button>",
  },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const GoogleLoginStub = {
  props: ["callback"],
  template:
    "<button data-test='google-login' @click='callback({ credential: \"token\" })'>Google</button>",
};

const VueRecaptchaStub = {
  template:
    "<button data-test='captcha' @click=\"$emit('verify', 'token')\">Captcha</button>",
};

const mountSignOn = (pinia) =>
  mount(SignOn, {
    global: {
      plugins: [pinia],
      stubs: {
        GoogleLogin: GoogleLoginStub,
        VueRecaptcha: VueRecaptchaStub,
        RouterLink: { template: "<a><slot /></a>" },
      },
    },
  });

const fillSignOnForm = async (wrapper, {
  email = "user@test.com",
  firstName = "Ana",
  lastName = "Lopez",
  password = "secret",
  confirmPassword = "secret",
} = {}) => {
  await wrapper.get("#email").setValue(email);
  await wrapper.get("#first_name").setValue(firstName);
  await wrapper.get("#last_name").setValue(lastName);
  await wrapper.get("#password").setValue(password);
  await wrapper.get("#confirm_password").setValue(confirmPassword);
};

const acceptPrivacyPolicy = async (wrapper) => {
  await wrapper.get("#privacy-policy").setValue(true);
};

const verifyCaptcha = async (wrapper) => {
  await wrapper.get("[data-test='captcha']").trigger("click");
  await flushPromises();
};

describe("SignOn.vue", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
    mockFetchSiteKey.mockResolvedValue("site-key");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("sends verification passcode when form is valid", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);

    axios.post.mockResolvedValue({ data: { passcode: "123" } });

    const wrapper = mountSignOn(pinia);

    await flushPromises();

    await fillSignOnForm(wrapper);
    await acceptPrivacyPolicy(wrapper);
    await verifyCaptcha(wrapper);
    await wrapper.get("button[type='submit']").trigger("click");
    await flushPromises();

    expect(axios.post).toHaveBeenCalledWith("/api/sign_on/send_verification_code/", {
      email: "user@test.com",
      captcha_token: "token",
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Se ha enviado un código de acceso a tu correo electrónico",
      "info"
    );
    expect(wrapper.text()).toContain("Verificar");
  });

  test("completes sign on when passcode matches", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();

    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);
    authStore.login = jest.fn();

    axios.post.mockImplementation((url) => {
      if (url === "/api/sign_on/send_verification_code/") {
        return Promise.resolve({ data: { passcode: "123" } });
      }
      if (url === "/api/sign_on/") {
        return Promise.resolve({ data: { access: "token", user: { id: 1 } } });
      }
      return Promise.resolve({ data: {} });
    });

    const wrapper = mountSignOn(pinia);

    await flushPromises();

    await fillSignOnForm(wrapper);
    await acceptPrivacyPolicy(wrapper);
    await verifyCaptcha(wrapper);
    await wrapper.get("button[type='submit']").trigger("click");
    await flushPromises();

    await wrapper.get("#passcode").setValue("123");
    await wrapper.get("#passcode + button").trigger("click");
    await flushPromises();

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
    expect(wrapper.get("#email").element.value).toBe("user@test.com");
  });

  test("rejects sign on when passcode is empty", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);

    axios.post.mockImplementation((url) => {
      if (url === "/api/sign_on/send_verification_code/") {
        return Promise.resolve({ data: { passcode: "123" } });
      }
      return Promise.resolve({ data: {} });
    });

    const wrapper = mountSignOn(pinia);

    await flushPromises();

    await fillSignOnForm(wrapper);
    await acceptPrivacyPolicy(wrapper);
    await verifyCaptcha(wrapper);
    await wrapper.get("button[type='submit']").trigger("click");
    await flushPromises();

    await wrapper.get("#passcode").setValue("");
    await wrapper.get("#passcode + button").trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("El código de verificación es obligatorio", "warning");
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(wrapper.get("#passcode").element.value).toBe("");
  });

  test("delegates Google login handler", async () => {
    const authStore = useAuthStore();
    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);

    const wrapper = mountSignOn(pinia);

    await flushPromises();

    await wrapper.get("[data-test='google-login']").trigger("click");
    expect(wrapper.get("[data-test='google-login']").text()).toContain("Google");

    expect(mockLoginWithGoogle).toHaveBeenCalledWith(
      { credential: "token" },
      expect.any(Object),
      authStore
    );
  });
});
