import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useCaptchaStore } from "@/stores/auth/captcha";

const mock = new AxiosMockAdapter(axios);

describe("Captcha Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  test("initializes with empty state", () => {
    const store = useCaptchaStore();

    expect(store.siteKey).toBe(null);
    expect(store.verified).toBe(false);
  });

  test("fetchSiteKey returns cached siteKey when already present", async () => {
    const store = useCaptchaStore();
    store.siteKey = "cached";

    const result = await store.fetchSiteKey();

    expect(result).toBe("cached");
    expect(mock.history.get).toHaveLength(0);
  });

  test("fetchSiteKey fetches from backend and stores it", async () => {
    const store = useCaptchaStore();

    mock.onGet("/api/google-captcha/site-key/").reply(200, { site_key: "public-key" });

    const result = await store.fetchSiteKey();

    expect(result).toBe("public-key");
    expect(store.siteKey).toBe("public-key");
    expect(mock.history.get).toHaveLength(1);
  });

  test("fetchSiteKey throws when backend errors", async () => {
    const store = useCaptchaStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/google-captcha/site-key/").reply(500, { detail: "err" });

    await expect(store.fetchSiteKey()).rejects.toBeTruthy();
    expect(store.siteKey).toBe(null);

    consoleSpy.mockRestore();
  });

  test("verify returns false when token is missing", async () => {
    const store = useCaptchaStore();

    const result = await store.verify("");

    expect(result).toBe(false);
    expect(store.verified).toBe(false);
    expect(mock.history.post).toHaveLength(0);
  });

  test("verify sets verified=true when backend validates token", async () => {
    const store = useCaptchaStore();

    mock.onPost("/api/google-captcha/verify/").reply(200, { success: true });

    const result = await store.verify("tok");

    expect(result).toBe(true);
    expect(store.verified).toBe(true);
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ token: "tok" });
  });

  test("verify sets verified=false when backend returns success=false", async () => {
    const store = useCaptchaStore();

    store.verified = true;

    mock.onPost("/api/google-captcha/verify/").reply(200, { success: false });

    const result = await store.verify("tok");

    expect(result).toBe(false);
    expect(store.verified).toBe(false);
  });

  test("verify returns false and sets verified=false when backend errors", async () => {
    const store = useCaptchaStore();

    store.verified = true;

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/google-captcha/verify/").reply(500, { detail: "err" });

    const result = await store.verify("tok");

    expect(result).toBe(false);
    expect(store.verified).toBe(false);

    consoleSpy.mockRestore();
  });

  test("reset sets verified=false", () => {
    const store = useCaptchaStore();

    store.verified = true;
    store.reset();

    expect(store.verified).toBe(false);
  });
});
