const mockAxiosPost = jest.fn();
const mockShowNotification = jest.fn();
const mockSignInWithMicrosoft = jest.fn();

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    post: (...args) => mockAxiosPost(...args),
  },
  post: (...args) => mockAxiosPost(...args),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/shared/msal_config", () => ({
  __esModule: true,
  signInWithMicrosoft: (...args) => mockSignInWithMicrosoft(...args),
}));

import { loginWithOutlook } from "@/shared/login_with_outlook";

describe("login_with_outlook.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignInWithMicrosoft.mockResolvedValue({ idToken: "ms-id-token" });
  });

  test("posts the ID token and notifies when a new account is created", async () => {
    const router = { push: jest.fn() };
    const authStore = { login: jest.fn() };

    mockAxiosPost.mockResolvedValueOnce({ data: { access: "t", created: true } });

    await loginWithOutlook(router, authStore);

    expect(mockAxiosPost).toHaveBeenCalledWith("/api/outlook_login/", {
      id_token: "ms-id-token",
    });
    expect(authStore.login).toHaveBeenCalledWith({ access: "t", created: true });
    expect(mockShowNotification).toHaveBeenCalledWith("¡Registro exitoso!", "success");
    expect(router.push).toHaveBeenCalledWith({ name: "dashboard" });
  });

  test("notifies a normal login when the user already exists", async () => {
    const router = { push: jest.fn() };
    const authStore = { login: jest.fn() };

    mockAxiosPost.mockResolvedValueOnce({ data: { access: "t", created: false } });

    await loginWithOutlook(router, authStore);

    expect(mockShowNotification).toHaveBeenCalledWith(
      "¡Inicio de sesión exitoso!",
      "success"
    );
    expect(router.push).toHaveBeenCalledWith({ name: "dashboard" });
  });

  test("redirects to a custom location with custom messages from options", async () => {
    const router = { push: jest.fn() };
    const authStore = { login: jest.fn() };
    const redirect = { name: "checkout" };

    mockAxiosPost.mockResolvedValueOnce({ data: { access: "t", created: true } });

    await loginWithOutlook(router, authStore, {
      redirect,
      successMessageCreated: "Cuenta creada",
    });

    expect(mockShowNotification).toHaveBeenCalledWith("Cuenta creada", "success");
    expect(router.push).toHaveBeenCalledWith(redirect);
  });

  test("shows a warning and does not log in when the popup is cancelled", async () => {
    const router = { push: jest.fn() };
    const authStore = { login: jest.fn() };

    mockSignInWithMicrosoft.mockRejectedValueOnce({ errorCode: "user_cancelled" });

    await loginWithOutlook(router, authStore);

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Autenticación con Microsoft cancelada",
      "warning"
    );
    expect(authStore.login).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  test("shows an error notification when the backend call fails", async () => {
    const router = { push: jest.fn() };
    const authStore = { login: jest.fn() };
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockAxiosPost.mockRejectedValueOnce(new Error("fail"));

    await loginWithOutlook(router, authStore);

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error durante el inicio de sesión con Microsoft",
      "error"
    );
    expect(authStore.login).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
