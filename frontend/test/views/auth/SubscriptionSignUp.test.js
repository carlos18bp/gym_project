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

const getSetupState = (wrapper) => wrapper.vm.$.setupState;

const fillRegistrationForm = (wrapper, values = {}) => {
  const state = getSetupState(wrapper);
  const {
    email = "user@test.com",
    firstName = "Ana",
    lastName = "Lopez",
    password = "Secret123",
    confirmPassword = "Secret123",
  } = values;

  state.userForm.email = email;
  state.userForm.firstName = firstName;
  state.userForm.lastName = lastName;
  state.userForm.password = password;
  state.userForm.confirmPassword = confirmPassword;
};

const setPasscodeState = (wrapper, { passcodeSent, passcode, emailUsedToSentPasscode }) => {
  const state = getSetupState(wrapper);
  state.passcodeSent = passcodeSent;
  state.passcode = passcode;
  state.emailUsedToSentPasscode = emailUsedToSentPasscode;
};

const setPrivacyAccepted = (wrapper, accepted) => {
  getSetupState(wrapper).privacyAccepted = accepted;
};

const verifyCaptcha = (wrapper, token) => getSetupState(wrapper).onCaptchaVerified(token);
const sendVerificationPasscode = (wrapper) => getSetupState(wrapper).sendVerificationPasscode();
const signOnUser = (wrapper) => getSetupState(wrapper).signOnUser();
const handleGoogleSignUp = (wrapper, payload) => getSetupState(wrapper).handleLoginWithGoogle(payload);
const getPasscodeSent = (wrapper) => getSetupState(wrapper).passcodeSent;

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

    fillRegistrationForm(wrapper);
    setPrivacyAccepted(wrapper, true);
    await verifyCaptcha(wrapper, "token");

    await sendVerificationPasscode(wrapper);

    expect(axios.post).toHaveBeenCalledWith("/api/sign_on/send_verification_code/", {
      email: "user@test.com",
      captcha_token: "token",
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Se ha enviado un código de acceso a tu correo electrónico",
      "info"
    );
    expect(getPasscodeSent(wrapper)).toBe(true);
    jest.restoreAllMocks();
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

    fillRegistrationForm(wrapper);
    setPasscodeState(wrapper, {
      passcodeSent: "999",
      passcode: "999",
      emailUsedToSentPasscode: "user@test.com",
    });
    await verifyCaptcha(wrapper, "token");

    await signOnUser(wrapper);

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
    expect(mockRouterPush.mock.calls.length).toBe(1);
    jest.restoreAllMocks();
  });

  test("rejects sign on when passcode is empty", async () => {
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

    fillRegistrationForm(wrapper);
    setPasscodeState(wrapper, {
      passcodeSent: true,
      passcode: "",
      emailUsedToSentPasscode: "user@test.com",
    });
    await verifyCaptcha(wrapper, "token");

    await signOnUser(wrapper);

    expect(mockShowNotification).toHaveBeenCalledWith("El código de verificación es obligatorio", "warning");
    expect(axios.post).not.toHaveBeenCalled();
    expect(mockRouterPush.mock.calls.length).toBe(0);
    jest.restoreAllMocks();
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

    await expect(sendVerificationPasscode(wrapper)).rejects.toThrow(
      "Email required"
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      "El correo electrónico es obligatorio",
      "warning"
    );
    jest.restoreAllMocks();
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

    await handleGoogleSignUp(wrapper, { credential: "token" });

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
    expect(mockRouterPush.mock.calls.length).toBe(1);
    jest.restoreAllMocks();
  });
});
