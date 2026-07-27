const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockHandleRedirectPromise = jest.fn().mockResolvedValue(null);
const mockLoginPopup = jest.fn().mockResolvedValue({ idToken: "fake-id-token" });
const mockConstructorSpy = jest.fn();

jest.mock("@azure/msal-browser", () => ({
  LogLevel: { Error: 0, Warning: 1, Info: 2, Verbose: 3, Trace: 4 },
  PublicClientApplication: class {
    constructor(config) {
      mockConstructorSpy(config);
      this.initialize = mockInitialize;
      this.handleRedirectPromise = mockHandleRedirectPromise;
      this.loginPopup = mockLoginPopup;
    }
  },
}));

const loadModule = () => {
  let mod;
  jest.isolateModules(() => {
    mod = require("@/shared/msal_config");
  });
  return mod;
};

describe("shared/msal_config", () => {
  beforeEach(() => {
    mockInitialize.mockClear();
    mockHandleRedirectPromise.mockClear();
    mockLoginPopup.mockClear();
    mockConstructorSpy.mockClear();
    window.sessionStorage.clear();
    // The Vite env is exposed to Jest as process.env (test/babel/vite-meta-env.cjs)
    process.env.VITE_MICROSOFT_CLIENT_ID = "test-client-id";
  });

  afterEach(() => {
    delete window.__e2eOutlookAuth;
    delete process.env.VITE_MICROSOFT_CLIENT_ID;
  });

  test("msalConfig uses the multi-tenant common authority", () => {
    const { msalConfig } = loadModule();

    expect(msalConfig.auth.authority).toBe(
      "https://login.microsoftonline.com/common"
    );
  });

  test("msalConfig redirectUri points to the outlook callback on the fallback domain", () => {
    const { msalConfig } = loadModule();

    expect(msalConfig.auth.redirectUri).toBe(
      "http://localhost:5173/auth/outlook/callback"
    );
  });

  test("msalConfig stores auth cache in sessionStorage without cookies", () => {
    const { msalConfig } = loadModule();

    expect(msalConfig.cache).toEqual({
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    });
  });

  test("loginRequest asks for the standard OpenID Connect scopes", () => {
    const { loginRequest } = loadModule();

    expect(loginRequest.scopes).toEqual(["openid", "profile", "email"]);
  });

  test("loginRequest asks Microsoft to show the account picker", () => {
    const { loginRequest } = loadModule();

    expect(loginRequest.prompt).toBe("select_account");
  });

  test("getMsalInstance constructs the client with msalConfig", async () => {
    const { getMsalInstance, msalConfig } = loadModule();

    await getMsalInstance();

    expect(mockConstructorSpy).toHaveBeenCalledWith(msalConfig);
  });

  test("getMsalInstance initializes the client before returning it", async () => {
    const { getMsalInstance } = loadModule();

    await getMsalInstance();

    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  test("getMsalInstance settles any interaction pending from a previous page load", async () => {
    const { getMsalInstance } = loadModule();

    await getMsalInstance();

    expect(mockHandleRedirectPromise).toHaveBeenCalledTimes(1);
  });

  test("getMsalInstance reuses the same instance on subsequent calls", async () => {
    const { getMsalInstance } = loadModule();

    const first = await getMsalInstance();
    const second = await getMsalInstance();

    expect(second).toBe(first);
    expect(mockConstructorSpy).toHaveBeenCalledTimes(1);
  });

  test("getMsalInstance builds a single client for concurrent callers", async () => {
    const { getMsalInstance } = loadModule();

    await Promise.all([getMsalInstance(), getMsalInstance()]);

    expect(mockConstructorSpy).toHaveBeenCalledTimes(1);
  });

  test("getMsalInstance rejects when the Microsoft client id is not configured", async () => {
    delete process.env.VITE_MICROSOFT_CLIENT_ID;
    const { getMsalInstance } = loadModule();

    await expect(getMsalInstance()).rejects.toThrow(
      "VITE_MICROSOFT_CLIENT_ID is not configured"
    );
  });

  test("signInWithMicrosoft delegates to the E2E seam when injected", async () => {
    const seamResult = { idToken: "e2e-token" };
    window.__e2eOutlookAuth = jest.fn().mockResolvedValue(seamResult);
    const { signInWithMicrosoft } = loadModule();

    const result = await signInWithMicrosoft();

    expect(result).toBe(seamResult);
    expect(mockLoginPopup).not.toHaveBeenCalled();
  });

  test("signInWithMicrosoft opens the MSAL popup with the login scopes", async () => {
    const { signInWithMicrosoft, loginRequest } = loadModule();

    const result = await signInWithMicrosoft();

    expect(mockLoginPopup).toHaveBeenCalledWith(loginRequest);
    expect(result).toEqual({ idToken: "fake-id-token" });
  });

  test("signInWithMicrosoft opens a single popup for concurrent calls", async () => {
    let resolvePopup;
    const popupResult = new Promise((resolve) => {
      resolvePopup = resolve;
    });
    mockLoginPopup.mockImplementationOnce(() => popupResult);
    const { signInWithMicrosoft } = loadModule();

    const first = signInWithMicrosoft();
    const second = signInWithMicrosoft();
    resolvePopup({ idToken: "shared-token" });
    await Promise.all([first, second]);

    expect(mockLoginPopup).toHaveBeenCalledTimes(1);
  });

  test("signInWithMicrosoft clears a stale interaction flag left by an orphaned popup", async () => {
    window.sessionStorage.setItem(
      "msal.test-client-id.interaction.status",
      "interaction_in_progress"
    );
    mockLoginPopup
      .mockRejectedValueOnce({ errorCode: "interaction_in_progress" })
      .mockResolvedValueOnce({ idToken: "token-after-retry" });
    const { signInWithMicrosoft } = loadModule();

    await signInWithMicrosoft();

    expect(
      window.sessionStorage.getItem("msal.test-client-id.interaction.status")
    ).toBeNull();
  });

  test("signInWithMicrosoft retries the popup once after clearing a stale interaction", async () => {
    mockLoginPopup
      .mockRejectedValueOnce({ errorCode: "interaction_in_progress" })
      .mockResolvedValueOnce({ idToken: "token-after-retry" });
    const { signInWithMicrosoft } = loadModule();

    const result = await signInWithMicrosoft();

    expect(result).toEqual({ idToken: "token-after-retry" });
  });

  test("signInWithMicrosoft propagates errors other than interaction_in_progress", async () => {
    mockLoginPopup.mockRejectedValueOnce({ errorCode: "user_cancelled" });
    const { signInWithMicrosoft } = loadModule();

    await expect(signInWithMicrosoft()).rejects.toEqual({
      errorCode: "user_cancelled",
    });
  });

  test("clearMsalCache removes MSAL entries from sessionStorage", () => {
    window.sessionStorage.setItem("msal.test-client-id.idtoken", "cached");
    const { clearMsalCache } = loadModule();

    clearMsalCache();

    expect(window.sessionStorage.getItem("msal.test-client-id.idtoken")).toBeNull();
  });

  test("clearMsalCache keeps entries that do not belong to MSAL", () => {
    window.sessionStorage.setItem("pendingSignaturesAlerted", "true");
    const { clearMsalCache } = loadModule();

    clearMsalCache();

    expect(window.sessionStorage.getItem("pendingSignaturesAlerted")).toBe("true");
  });
});
