import { useGuidedTour, AUTO_START_DELAY_MS } from "@/composables/useGuidedTour";

const mockGetRequest = jest.fn();
const mockCreateRequest = jest.fn();
jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: (...args) => mockGetRequest(...args),
  create_request: (...args) => mockCreateRequest(...args),
}));

const mockShowConfirmationAlert = jest.fn();
jest.mock("@/shared/confirmation_alert", () => ({
  __esModule: true,
  showConfirmationAlert: (...args) => mockShowConfirmationAlert(...args),
}));

const mockDriverInstance = {
  drive: jest.fn(),
  destroy: jest.fn(),
  moveNext: jest.fn(),
  movePrevious: jest.fn(),
  getActiveIndex: jest.fn(() => 0),
};
const mockDriver = jest.fn(() => mockDriverInstance);
jest.mock("driver.js", () => ({
  __esModule: true,
  driver: (...args) => mockDriver(...args),
}));

const ALL_TARGETS = [
  "tabs-nav",
  "tab-legal-documents",
  "tab-folders",
  "tab-my-documents",
  "tab-pending-signatures",
  "tab-signed-documents",
  "tab-finished-documents",
  "btn-new-minuta",
  "btn-new-document",
  "btn-electronic-signature",
  "btn-global-letterhead",
];

function mountTourTargets() {
  document.body.innerHTML = ALL_TARGETS.map(
    (target) => `<button data-tour="${target}"></button>`,
  ).join("");
}

function makeTour(overrides = {}) {
  const setActiveTab = jest.fn();
  const tour = useGuidedTour({
    module: "dynamic_documents",
    getRole: () => "lawyer",
    setActiveTab,
    getContext: () => ({ hasPendingSignatures: false }),
    ...overrides,
  });
  return { tour, setActiveTab };
}

beforeAll(() => {
  // jsdom has no layout: offsetParent is always null, which would filter
  // every step out. Attached nodes report their parent instead.
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      return this.parentNode;
    },
  });
  window.requestAnimationFrame = (callback) => {
    callback();
    return 0;
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = "";
  window.matchMedia = jest.fn().mockReturnValue({ matches: true });
});

describe("useGuidedTour — fetchTourStatus", () => {
  it("stores a valid status from the API", async () => {
    mockGetRequest.mockResolvedValue({ data: { status: "never" } });
    const { tour } = makeTour();

    await tour.fetchTourStatus();

    expect(mockGetRequest).toHaveBeenCalledWith(
      "tour-progress/?module=dynamic_documents",
    );
    expect(tour.tourStatus.value).toBe("never");
  });

  it("resolves unknown responses to null (fail-safe)", async () => {
    mockGetRequest.mockResolvedValue({ data: {} });
    const { tour } = makeTour();

    await tour.fetchTourStatus();

    expect(tour.tourStatus.value).toBeNull();
  });

  it("resolves API errors to null", async () => {
    mockGetRequest.mockRejectedValue(new Error("network"));
    const { tour } = makeTour();

    await tour.fetchTourStatus();

    expect(tour.tourStatus.value).toBeNull();
  });
});

describe("useGuidedTour — maybeAutoStartTour", () => {
  it("auto-starts the tour after the delay when status is never", async () => {
    jest.useFakeTimers();
    mockGetRequest.mockResolvedValue({ data: { status: "never" } });
    mountTourTargets();
    const { tour } = makeTour();

    await tour.maybeAutoStartTour();
    expect(mockDriver).not.toHaveBeenCalled();

    jest.advanceTimersByTime(AUTO_START_DELAY_MS);
    await Promise.resolve();

    expect(mockDriver).toHaveBeenCalledTimes(1);
    expect(mockDriverInstance.drive).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it("does nothing when status is recent", async () => {
    mockGetRequest.mockResolvedValue({ data: { status: "recent" } });
    mountTourTargets();
    const { tour } = makeTour();

    await tour.maybeAutoStartTour();

    expect(mockShowConfirmationAlert).not.toHaveBeenCalled();
    expect(mockDriverInstance.drive).not.toHaveBeenCalled();
  });

  it("does nothing when the status is unknown (fail-safe)", async () => {
    mockGetRequest.mockResolvedValue({ data: {} });
    mountTourTargets();
    const { tour } = makeTour();

    await tour.maybeAutoStartTour();

    expect(mockShowConfirmationAlert).not.toHaveBeenCalled();
    expect(mockDriverInstance.drive).not.toHaveBeenCalled();
  });

  it("offers the tour and starts it on confirm when status is stale", async () => {
    mockGetRequest.mockResolvedValue({ data: { status: "stale" } });
    mockShowConfirmationAlert.mockResolvedValue(true);
    mountTourTargets();
    const { tour } = makeTour();

    await tour.maybeAutoStartTour();

    expect(mockShowConfirmationAlert).toHaveBeenCalledWith(
      "¿Quieres ver la guía del módulo de Archivos Jurídicos?",
    );
    expect(mockDriverInstance.drive).toHaveBeenCalledTimes(1);
  });

  it("marks completion without starting when the stale offer is declined", async () => {
    mockGetRequest.mockResolvedValue({ data: { status: "stale" } });
    mockShowConfirmationAlert.mockResolvedValue(false);
    mockCreateRequest.mockResolvedValue({ data: { status: "recent" } });
    mountTourTargets();
    const { tour } = makeTour();

    await tour.maybeAutoStartTour();

    expect(mockCreateRequest).toHaveBeenCalledWith("tour-progress/complete/", {
      module_name: "dynamic_documents",
    });
    expect(mockDriverInstance.drive).not.toHaveBeenCalled();
  });
});

describe("useGuidedTour — startTour", () => {
  it("does not start when no step target is available", async () => {
    // Client steps carry no tab metadata, so an empty DOM filters all out.
    const { tour } = makeTour({ getRole: () => "client" });

    await tour.startTour();

    expect(mockDriver).not.toHaveBeenCalled();
    expect(tour.isTourActive.value).toBe(false);
  });

  it("drops desktop-only steps on mobile viewports", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    mountTourTargets();
    const { tour } = makeTour({ getRole: () => "client" });

    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    // Client tour on mobile: tabs-nav + Nuevo Documento + Firma Electrónica.
    expect(config.steps).toHaveLength(3);
  });

  it("configures Spanish button texts and progress", async () => {
    mountTourTargets();
    const { tour } = makeTour();

    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    expect(config.nextBtnText).toBe("Siguiente");
    expect(config.prevBtnText).toBe("Anterior");
    expect(config.doneBtnText).toBe("Finalizar");
    expect(config.progressText).toBe("Paso {{current}} de {{total}}");
    expect(tour.isTourActive.value).toBe(true);
  });
});

describe("useGuidedTour — completion", () => {
  it("marks completion exactly once when the tour is destroyed", async () => {
    mockCreateRequest.mockResolvedValue({ data: { status: "recent" } });
    mountTourTargets();
    const { tour } = makeTour();
    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    config.onDestroyed();
    config.onDestroyed();

    expect(mockCreateRequest).toHaveBeenCalledTimes(1);
    expect(tour.isTourActive.value).toBe(false);
  });
});

describe("useGuidedTour — tab switching", () => {
  it("switches to the destination tab before moving forward", async () => {
    mountTourTargets();
    const { tour, setActiveTab } = makeTour();
    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    // Lawyer step index 2 is "Nueva Minuta", which requires the
    // legal-documents tab; moving from index 1 must switch first.
    mockDriverInstance.getActiveIndex.mockReturnValue(1);
    config.onNextClick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setActiveTab).toHaveBeenCalledWith("legal-documents");
    expect(mockDriverInstance.moveNext).toHaveBeenCalledTimes(1);
    expect(setActiveTab.mock.invocationCallOrder[0]).toBeLessThan(
      mockDriverInstance.moveNext.mock.invocationCallOrder[0],
    );
  });

  it("moves back without switching when the previous step has no tab", async () => {
    mountTourTargets();
    const { tour, setActiveTab } = makeTour();
    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    // Moving from index 1 back to index 0 (tabs overview, no tab).
    mockDriverInstance.getActiveIndex.mockReturnValue(1);
    config.onPrevClick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setActiveTab).not.toHaveBeenCalled();
    expect(mockDriverInstance.movePrevious).toHaveBeenCalledTimes(1);
  });
});
