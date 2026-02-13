function setUserAgent(userAgent) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
}

function setStandaloneValue(value) {
  Object.defineProperty(window.navigator, "standalone", {
    value,
    configurable: true,
  });
}

function mockMatchMedia(matchesByQuery = {}) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: Boolean(matchesByQuery[query]),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}

async function loadUsePWAInstall() {
  jest.resetModules();
  const mod = await import("@/composables/usePWAInstall");
  return mod.usePWAInstall;
}

describe("usePWAInstall", () => {
  beforeEach(() => {
    localStorage.clear();
    mockMatchMedia({
      "(display-mode: standalone)": false,
      "(display-mode: window-controls-overlay)": false,
      "(display-mode: minimal-ui)": false,
      "(display-mode: standalone)": false,
    });
    setStandaloneValue(false);
    setUserAgent("Mozilla/5.0");
  });

  test("detects browser: chrome / edge / firefox / safari / unknown", async () => {
    let usePWAInstall = await loadUsePWAInstall();

    setUserAgent("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36");
    let composable = usePWAInstall();
    expect(composable.currentBrowser.value).toBe("chrome");

    usePWAInstall = await loadUsePWAInstall();
    setUserAgent("Mozilla/5.0 Edg/120.0.0.0 Chrome/120.0.0.0 Safari/537.36");
    composable = usePWAInstall();
    expect(composable.currentBrowser.value).toBe("edge");

    usePWAInstall = await loadUsePWAInstall();
    setUserAgent("Mozilla/5.0 Firefox/120.0");
    composable = usePWAInstall();
    expect(composable.currentBrowser.value).toBe("firefox");

    usePWAInstall = await loadUsePWAInstall();
    setUserAgent("Mozilla/5.0 Safari/605.1.15");
    composable = usePWAInstall();
    expect(composable.currentBrowser.value).toBe("safari");

    usePWAInstall = await loadUsePWAInstall();
    setUserAgent("SomeCustomBrowser");
    composable = usePWAInstall();
    expect(composable.currentBrowser.value).toBe("unknown");
  });

  test("initializes isAppInstalled true when running in standalone mode and persists to localStorage", async () => {
    mockMatchMedia({
      "(display-mode: standalone)": true,
      "(display-mode: window-controls-overlay)": false,
      "(display-mode: minimal-ui)": false,
    });

    const usePWAInstall = await loadUsePWAInstall();
    const { isAppInstalled } = usePWAInstall();

    expect(isAppInstalled.value).toBe(true);
    expect(localStorage.getItem("pwa-installed")).toBe("true");
  });

  test("initializes isAppInstalled true when localStorage says previously installed even if not standalone now", async () => {
    localStorage.setItem("pwa-installed", "true");

    mockMatchMedia({
      "(display-mode: standalone)": false,
      "(display-mode: window-controls-overlay)": false,
      "(display-mode: minimal-ui)": false,
    });
    setStandaloneValue(false);

    const usePWAInstall = await loadUsePWAInstall();
    const { isAppInstalled } = usePWAInstall();

    expect(isAppInstalled.value).toBe(true);
  });

  test("initializePWA runs only once and keeps initial browser detection", async () => {
    let usePWAInstall = await loadUsePWAInstall();

    setUserAgent("Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36");
    const first = usePWAInstall();
    expect(first.currentBrowser.value).toBe("chrome");

    setUserAgent("Mozilla/5.0 Firefox/120.0");
    const second = usePWAInstall();

    expect(second.currentBrowser.value).toBe("chrome");
  });

  test("promptInstall: when deferredPrompt exists, calls prompt() and sets installed when accepted", async () => {
    const usePWAInstall = await loadUsePWAInstall();
    const { isAppInstalled, promptInstall } = usePWAInstall();

    const e = new Event("beforeinstallprompt");
    e.preventDefault = jest.fn();
    e.prompt = jest.fn();
    e.userChoice = Promise.resolve({ outcome: "accepted" });

    window.dispatchEvent(e);

    expect(isAppInstalled.value).toBe(false);

    promptInstall();

    expect(e.prompt).toHaveBeenCalled();

    await Promise.resolve();

    expect(isAppInstalled.value).toBe(true);
  });

  test("promptInstall: when deferredPrompt exists and dismissed, clears prompt but does not mark installed", async () => {
    const usePWAInstall = await loadUsePWAInstall();
    const { isAppInstalled, promptInstall } = usePWAInstall();

    const e = new Event("beforeinstallprompt");
    e.preventDefault = jest.fn();
    e.prompt = jest.fn();
    e.userChoice = Promise.resolve({ outcome: "dismissed" });

    window.dispatchEvent(e);

    promptInstall();

    await Promise.resolve();

    expect(isAppInstalled.value).toBe(false);
  });

  test("promptInstall: when deferredPrompt missing, shows instructions modal", async () => {
    const usePWAInstall = await loadUsePWAInstall();
    const { showInstructionsModal, promptInstall } = usePWAInstall();

    expect(showInstructionsModal.value).toBe(false);

    promptInstall();

    expect(showInstructionsModal.value).toBe(true);
  });

  test("closeInstructionsModal closes modal", async () => {
    const usePWAInstall = await loadUsePWAInstall();
    const { showInstructionsModal, promptInstall, closeInstructionsModal } =
      usePWAInstall();

    promptInstall();
    expect(showInstructionsModal.value).toBe(true);

    closeInstructionsModal();
    expect(showInstructionsModal.value).toBe(false);
  });

  test("appinstalled event marks installed and clears deferredPrompt", async () => {
    const usePWAInstall = await loadUsePWAInstall();
    const { isAppInstalled, promptInstall } = usePWAInstall();

    const e = new Event("beforeinstallprompt");
    e.preventDefault = jest.fn();
    e.prompt = jest.fn();
    e.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(e);

    promptInstall();
    await Promise.resolve();
    expect(isAppInstalled.value).toBe(false);

    window.dispatchEvent(new Event("appinstalled"));

    expect(isAppInstalled.value).toBe(true);
  });

  test("re-checks on visibilitychange when document becomes visible", async () => {
    const usePWAInstall = await loadUsePWAInstall();
    const { isAppInstalled } = usePWAInstall();

    expect(isAppInstalled.value).toBe(false);

    mockMatchMedia({
      "(display-mode: standalone)": true,
      "(display-mode: window-controls-overlay)": false,
      "(display-mode: minimal-ui)": false,
    });

    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(isAppInstalled.value).toBe(true);
  });

  test("visibilitychange does not re-check when document is hidden", async () => {
    const usePWAInstall = await loadUsePWAInstall();
    const { isAppInstalled } = usePWAInstall();

    expect(isAppInstalled.value).toBe(false);

    mockMatchMedia({
      "(display-mode: standalone)": true,
      "(display-mode: window-controls-overlay)": false,
      "(display-mode: minimal-ui)": false,
    });

    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(isAppInstalled.value).toBe(false);
  });
});
