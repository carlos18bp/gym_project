const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockLoginPopup = jest.fn().mockResolvedValue({ idToken: "fake-id-token" });
const mockConstructorSpy = jest.fn();

jest.mock("@azure/msal-browser", () => ({
  PublicClientApplication: class {
    constructor(config) {
      mockConstructorSpy(config);
      this.initialize = mockInitialize;
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
    mockLoginPopup.mockClear();
    mockConstructorSpy.mockClear();
  });

  afterEach(() => {
    delete window.__e2eOutlookAuth;
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

  test("getMsalInstance reuses the same instance on subsequent calls", async () => {
    const { getMsalInstance } = loadModule();

    const first = await getMsalInstance();
    const second = await getMsalInstance();

    expect(second).toBe(first);
    expect(mockConstructorSpy).toHaveBeenCalledTimes(1);
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
});
