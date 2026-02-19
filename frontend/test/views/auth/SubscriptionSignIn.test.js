import { mount } from "@vue/test-utils";
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

const mountSubscriptionSignIn = (pinia) =>
  mount(SubscriptionSignIn, {
    global: {
      plugins: [pinia],
      mocks: {
        $route: mockRoute,
      },
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

    authStore.login = jest.fn();
    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);
    authStore.attempsSignIn = jest.fn((action) => {
      if (action !== "initial") {
        authStore.signInTries += 1;
      }
    });

    axios.post.mockResolvedValue({ data: { access: "token", user: { id: 1 } } });

    const wrapper = mountSubscriptionSignIn(pinia);

    await flushPromises();

    await fillCredentials(wrapper, { email: "user@test.com", password: "secret" });
    await verifyCaptcha(wrapper);
    await wrapper.get("form").trigger("submit.prevent");
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
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "checkout",
      params: { plan: "cliente" },
    });
    expect(wrapper.get("#password").element.value).toBe("");
  });

  test("blocks submit when missing email", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();
    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);

    const wrapper = mountSubscriptionSignIn(pinia);

    await flushPromises();

    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

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

    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);
    authStore.attempsSignIn = jest.fn((action) => {
      if (action !== "initial") {
        authStore.signInTries += 1;
      }
    });

    const wrapper = mountSubscriptionSignIn(pinia);

    await flushPromises();

    await fillCredentials(wrapper, { email: "user@test.com", password: "secret" });
    await verifyCaptcha(wrapper);
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Has excedido el número máximo de intentos. Intenta más tarde.",
      "warning"
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("handles Google login flow", async () => {
    const axios = await import("axios");
    const authStore = useAuthStore();

    authStore.isAuthenticated = jest.fn().mockResolvedValue(false);
    authStore.login = jest.fn();

    axios.post.mockResolvedValue({ data: { access: "token", user: { id: 1 } } });

    const wrapper = mountSubscriptionSignIn(pinia);

    await flushPromises();

    await wrapper.get("[data-test='google-login']").trigger("click");

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
