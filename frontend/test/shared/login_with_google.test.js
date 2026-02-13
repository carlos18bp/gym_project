const mockAxiosPost = jest.fn();
const mockShowNotification = jest.fn();
const mockDecodeCredential = jest.fn();

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

jest.mock("vue3-google-login", () => ({
  __esModule: true,
  decodeCredential: (...args) => mockDecodeCredential(...args),
}));

import { loginWithGoogle } from "@/shared/login_with_google";

describe("login_with_google.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDecodeCredential.mockReturnValue({
      email: "user@test.com",
      given_name: "User",
      family_name: "Test",
      picture: "avatar",
    });
  });

  test("logs in and notifies when user is created", async () => {
    const router = { push: jest.fn() };
    const authStore = { login: jest.fn() };

    mockAxiosPost.mockResolvedValueOnce({ data: { token: "t", created: true } });

    await loginWithGoogle({ credential: "token" }, router, authStore);

    expect(mockDecodeCredential).toHaveBeenCalledWith("token");
    expect(mockAxiosPost).toHaveBeenCalledWith("/api/google_login/", {
      email: "user@test.com",
      given_name: "User",
      family_name: "Test",
      picture: "avatar",
    });
    expect(authStore.login).toHaveBeenCalledWith({ token: "t", created: true });
    expect(mockShowNotification).toHaveBeenCalledWith("¡Registro exitoso!", "success");
    expect(router.push).toHaveBeenCalledWith({ name: "dashboard" });
  });

  test("logs in and notifies when user already exists", async () => {
    const router = { push: jest.fn() };
    const authStore = { login: jest.fn() };

    mockAxiosPost.mockResolvedValueOnce({ data: { token: "t", created: false } });

    await loginWithGoogle({ credential: "token" }, router, authStore);

    expect(authStore.login).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "¡Inicio de sesión exitoso!",
      "success"
    );
    expect(router.push).toHaveBeenCalledWith({ name: "dashboard" });
  });

  test("handles errors and notifies", async () => {
    const router = { push: jest.fn() };
    const authStore = { login: jest.fn() };
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockAxiosPost.mockRejectedValueOnce(new Error("fail"));

    await loginWithGoogle({ credential: "token" }, router, authStore);

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error durante el inicio de sesión",
      "error"
    );
    expect(authStore.login).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
