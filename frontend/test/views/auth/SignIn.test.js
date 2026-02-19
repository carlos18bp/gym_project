import { mount } from "@vue/test-utils";
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

const mountSignIn = (pinia) =>
  mount(SignIn, {
    global: {
      plugins: [pinia],
      stubs: {
        GoogleLogin: GoogleLoginStub,
        VueRecaptcha: VueRecaptchaStub,
        RouterLink: { template: "<a><slot /></a>" },
      },
    },
  });

const fillCredentials = async (wrapper, { email, password }) => {
  if (email !== undefined) {
    await wrapper.get("#email").setValue(email);
  }
  if (password !== undefined) {
    await wrapper.get("#password").setValue(password);
  }
};

const verifyCaptcha = async (wrapper) => {
  await wrapper.get("[data-test='captcha']").trigger("click");
  await flushPromises();
};

describe("SignIn.vue", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
    mockFetchSiteKey.mockResolvedValue("site-key");
  });

  test("submits credentials and redirects on success", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();

    authStore.login = jest.fn();
    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);
    authStore.attempsSignIn = jest.fn((action) => {
      if (action !== "initial") {
        authStore.signInTries += 1;
      }
    });

    axios.post.mockResolvedValue({ data: { access: "token", user: { id: 1 } } });

    const wrapper = mountSignIn(pinia);

    await flushPromises();

    await fillCredentials(wrapper, { email: "user@test.com", password: "secret" });
    await verifyCaptcha(wrapper);
    await wrapper.get("button[type='submit']").trigger("click");
    await flushPromises();

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
    expect(wrapper.get("#password").element.value).toBe("");
  });

  test("blocks submit when fields are missing", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);

    const wrapper = mountSignIn(pinia);

    await flushPromises();

    await wrapper.get("button[type='submit']").trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Email is required!", "warning");
    expect(axios.post).not.toHaveBeenCalled();
    expect(wrapper.get("#email").element.value).toBe("");
  });

  test("warns when attempts reach the limit", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    authStore.signInTries = 2;

    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);
    authStore.attempsSignIn = jest.fn((action) => {
      if (action !== "initial") {
        authStore.signInTries += 1;
      }
    });

    const wrapper = mountSignIn(pinia);

    await flushPromises();

    await fillCredentials(wrapper, { email: "user@test.com", password: "secret" });
    await verifyCaptcha(wrapper);
    await wrapper.get("button[type='submit']").trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "You have exceeded the maximum number of attempts. Please try again later.",
      "warning"
    );
    expect(axios.post).not.toHaveBeenCalled();
    expect(authStore.signInTries).toBe(3);
  });

  test("delegates Google login handler", async () => {
    const authStore = useAuthStore();
    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);

    const wrapper = mountSignIn(pinia);

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
