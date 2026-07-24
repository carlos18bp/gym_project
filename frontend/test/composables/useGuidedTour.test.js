import { useGuidedTour, AUTO_START_DELAY_MS } from "@/composables/useGuidedTour";
import { EYEBROW_LABEL } from "@/shared/tours/dynamic_documents_steps";

const mockGetRequest = jest.fn();
const mockCreateRequest = jest.fn();
jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: (...args) => mockGetRequest(...args),
  create_request: (...args) => mockCreateRequest(...args),
}));

const mockShowTourOfferAlert = jest.fn();
jest.mock("@/shared/tours/tour_offer_alert", () => ({
  __esModule: true,
  showTourOfferAlert: (...args) => mockShowTourOfferAlert(...args),
}));

jest.mock("@/shared/tours/confetti", () => ({
  __esModule: true,
  fireTourConfetti: jest.fn(),
  TOUR_CONFETTI_COLORS: [],
}));
import { fireTourConfetti } from "@/shared/tours/confetti";

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
  "help-button",
];

function mountTourTargets() {
  document.body.innerHTML = ALL_TARGETS.map(
    (target) => `<button data-tour="${target}"></button>`,
  ).join("");
}

/** Minimal but structurally-complete PopoverDOM for the decorator. */
function makePopoverDom() {
  const wrapper = document.createElement("div");
  const title = document.createElement("header");
  const description = document.createElement("div");
  const footer = document.createElement("footer");
  const footerButtons = document.createElement("span");
  const progress = document.createElement("span");
  footer.appendChild(progress);
  footer.appendChild(footerButtons);
  wrapper.append(title, description, footer);
  document.body.appendChild(wrapper);
  return { wrapper, title, description, footer, footerButtons, progress };
}

function decorate(config, kind, extra = {}) {
  const popover = makePopoverDom();
  config.onPopoverRender(popover, {
    state: { activeStep: { data: { kind, ...extra } } },
  });
  return popover;
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
  test("stores a valid status from the API", async () => {
    mockGetRequest.mockResolvedValue({ data: { status: "never" } });
    const { tour } = makeTour();

    await tour.fetchTourStatus();

    expect(mockGetRequest).toHaveBeenCalledWith(
      "tour-progress/?module=dynamic_documents",
    );
    expect(tour.tourStatus.value).toBe("never");
  });

  test("resolves unknown responses to null (fail-safe)", async () => {
    mockGetRequest.mockResolvedValue({ data: {} });
    const { tour } = makeTour();

    await tour.fetchTourStatus();

    expect(tour.tourStatus.value).toBeNull();
  });

  test("resolves API errors to null", async () => {
    mockGetRequest.mockRejectedValue(new Error("network"));
    const { tour } = makeTour();

    await tour.fetchTourStatus();

    expect(tour.tourStatus.value).toBeNull();
  });
});

describe("useGuidedTour — maybeAutoStartTour", () => {
  test("auto-starts the tour after the delay when status is never", async () => {
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

  test("does nothing when status is recent", async () => {
    mockGetRequest.mockResolvedValue({ data: { status: "recent" } });
    mountTourTargets();
    const { tour } = makeTour();

    await tour.maybeAutoStartTour();

    expect(mockShowTourOfferAlert).not.toHaveBeenCalled();
    expect(mockDriverInstance.drive).not.toHaveBeenCalled();
  });

  test("does nothing when the status is unknown (fail-safe)", async () => {
    mockGetRequest.mockResolvedValue({ data: {} });
    mountTourTargets();
    const { tour } = makeTour();

    await tour.maybeAutoStartTour();

    expect(mockShowTourOfferAlert).not.toHaveBeenCalled();
    expect(mockDriverInstance.drive).not.toHaveBeenCalled();
  });

  test("offers the tour and starts it on confirm when status is stale", async () => {
    mockGetRequest.mockResolvedValue({ data: { status: "stale" } });
    mockShowTourOfferAlert.mockResolvedValue(true);
    mountTourTargets();
    const { tour } = makeTour();

    await tour.maybeAutoStartTour();

    expect(mockShowTourOfferAlert).toHaveBeenCalledWith(
      "¿Quieres ver la guía del módulo de Archivos Jurídicos?",
    );
    expect(mockDriverInstance.drive).toHaveBeenCalledTimes(1);
  });

  test("marks completion without starting when the stale offer is declined", async () => {
    mockGetRequest.mockResolvedValue({ data: { status: "stale" } });
    mockShowTourOfferAlert.mockResolvedValue(false);
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
  test("does not start when no content target is available", async () => {
    // Client steps carry no tab metadata, so an empty DOM filters all
    // content out — the framing cards must never show alone.
    const { tour } = makeTour({ getRole: () => "client" });

    await tour.startTour();

    expect(mockDriver).not.toHaveBeenCalled();
    expect(tour.isTourActive.value).toBe(false);
  });

  test("frames the tour with a welcome card and a help-button finale", async () => {
    mountTourTargets();
    const { tour } = makeTour();

    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    // Lawyer: welcome + 10 content + finale
    expect(config.steps).toHaveLength(12);
    expect(config.steps[0].data.kind).toBe("welcome");
    expect(config.steps[0].element).toBeUndefined();
    expect(config.steps[0].popover.nextBtnText).toBe("Comenzar recorrido");
    expect(config.steps[11].data.kind).toBe("finale");
    expect(config.steps[11].popover.doneBtnText).toBe("Entendido");
  });

  test("drops desktop-only steps on mobile viewports but keeps the framing cards", async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    mountTourTargets();
    const { tour } = makeTour({ getRole: () => "client" });

    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    // Client on mobile: welcome + (tabs-nav, Nuevo Documento, Firma) + finale
    expect(config.steps).toHaveLength(5);
    expect(config.steps[0].data.kind).toBe("welcome");
    expect(config.steps[4].data.kind).toBe("finale");
  });

  test("shows literal per-content-step progress over content steps only", async () => {
    mountTourTargets();
    const { tour } = makeTour();

    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    // driver.js quirk: per-step showProgress cannot turn OFF a global
    // true (they are OR'ed) — so the global is false and content opts in.
    expect(config.showProgress).toBe(false);
    expect(config.steps[1].popover.showProgress).toBe(true);
    expect(config.steps[1].popover.progressText).toBe("Paso 1 de 10");
    expect(config.steps[10].popover.progressText).toBe("Paso 10 de 10");
    expect(config.steps[0].popover.showProgress).toBeUndefined();
  });

  test("configures Spanish button texts and the branded overlay", async () => {
    mountTourTargets();
    const { tour } = makeTour();

    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    expect(config.nextBtnText).toBe("Siguiente");
    expect(config.prevBtnText).toBe("Anterior");
    expect(config.doneBtnText).toBe("Finalizar");
    expect(config.overlayColor).toBe("#141E30");
    expect(config.smoothScroll).toBe(true);
    expect(config.stageRadius).toBe(12);
    expect(tour.isTourActive.value).toBe(true);
  });
});

describe("useGuidedTour — popover decoration", () => {
  test("labels every popover with the module eyebrow", async () => {
    mountTourTargets();
    const { tour } = makeTour();
    await tour.startTour();

    const popover = decorate(mockDriver.mock.calls[0][0], "content", {
      index: 1,
      total: 10,
    });

    const eyebrow = popover.title.previousElementSibling;
    expect(eyebrow.className).toBe("gyj-tour-eyebrow");
    expect(eyebrow.textContent).toBe(EYEBROW_LABEL);
  });

  test("inserts an animated progress bar on content steps", async () => {
    mountTourTargets();
    const { tour } = makeTour();
    await tour.startTour();

    const popover = decorate(mockDriver.mock.calls[0][0], "content", {
      index: 1,
      total: 10,
    });

    const track = popover.footer.previousElementSibling;
    expect(track.className).toBe("gyj-tour-progress-track");
    // rAF is synchronous in this suite, so the fill already animated
    // from 0% to the current step's 10%.
    expect(track.firstChild.style.width).toBe("10%");
  });

  test("does not render a progress bar on the framing cards", async () => {
    // quality: allow-fragile-selector (asserts DOM the composable itself builds; gyj-tour-* classes are its public popover contract)
    mountTourTargets();
    const { tour } = makeTour();
    await tour.startTour();

    const popover = decorate(mockDriver.mock.calls[0][0], "welcome");

    expect(popover.wrapper.querySelector(".gyj-tour-progress-track")).toBeNull();
  });

  test("renders a circular icon on the framing cards", async () => {
    // quality: allow-fragile-selector (asserts DOM the composable itself builds; gyj-tour-* classes are its public popover contract)
    mountTourTargets();
    const { tour } = makeTour();
    await tour.startTour();

    const popover = decorate(mockDriver.mock.calls[0][0], "welcome");

    expect(popover.wrapper.firstChild.className).toBe("gyj-tour-card-icon");
    expect(popover.wrapper.firstChild.querySelector("svg")).not.toBeNull();
  });

  test("shows the keyboard hint on the welcome card only on desktop", async () => {
    // quality: allow-fragile-selector (asserts DOM the composable itself builds; gyj-tour-* classes are its public popover contract)
    mountTourTargets();
    const { tour } = makeTour();
    await tour.startTour();
    const config = mockDriver.mock.calls[0][0];

    const desktopPopover = decorate(config, "welcome");
    expect(
      desktopPopover.wrapper.querySelector(".gyj-tour-kbd-hint"),
    ).not.toBeNull();

    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    const mobilePopover = decorate(config, "welcome");
    expect(mobilePopover.wrapper.querySelector(".gyj-tour-kbd-hint")).toBeNull();
  });

  test.each([
    ["welcome", "Ahora no"],
    ["content", "Omitir guía"],
  ])("labels the skip button on %s steps as '%s'", async (kind, label) => {
    mountTourTargets();
    const { tour } = makeTour();
    await tour.startTour();

    const popover = decorate(mockDriver.mock.calls[0][0], kind, {
      index: 1,
      total: 10,
    });

    expect(popover.footerButtons.querySelector(".gyj-tour-skip-btn").innerText).toBe(
      label,
    );
  });

  test("renders no skip button on the finale card", async () => {
    // quality: allow-fragile-selector (asserts DOM the composable itself builds; gyj-tour-* classes are its public popover contract)
    mountTourTargets();
    const { tour } = makeTour();
    await tour.startTour();

    const popover = decorate(mockDriver.mock.calls[0][0], "finale");

    expect(popover.footerButtons.querySelector(".gyj-tour-skip-btn")).toBeNull();
  });
});

describe("useGuidedTour — completion", () => {
  test("marks completion exactly once when the tour is destroyed", async () => {
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

  test("registers completion from the skip button without waiting for onDestroyed", async () => {
    // quality: allow-fragile-selector (asserts DOM the composable itself builds; gyj-tour-* classes are its public popover contract)
    // driver.js only fires onDestroyed after the first highlight
    // transition settles; an early skip must still POST completion.
    mockCreateRequest.mockResolvedValue({ data: { status: "recent" } });
    mountTourTargets();
    const { tour } = makeTour();
    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    const popover = decorate(config, "content", { index: 1, total: 10 });
    const skipButton = popover.footerButtons.querySelector(".gyj-tour-skip-btn");

    skipButton.click();

    expect(mockCreateRequest).toHaveBeenCalledTimes(1);
    expect(mockDriverInstance.destroy).toHaveBeenCalledTimes(1);
    expect(fireTourConfetti).not.toHaveBeenCalled();

    // A late onDestroyed must not double-post
    config.onDestroyed();
    expect(mockCreateRequest).toHaveBeenCalledTimes(1);
  });

  test("registers completion from the close (✕) button without confetti", async () => {
    mockCreateRequest.mockResolvedValue({ data: { status: "recent" } });
    mountTourTargets();
    const { tour } = makeTour();
    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    config.onCloseClick();

    expect(mockCreateRequest).toHaveBeenCalledTimes(1);
    expect(mockDriverInstance.destroy).toHaveBeenCalledTimes(1);
    expect(fireTourConfetti).not.toHaveBeenCalled();
  });

  test("celebrates with confetti only on the real end of the tour", async () => {
    mockCreateRequest.mockResolvedValue({ data: { status: "recent" } });
    mountTourTargets();
    const { tour } = makeTour();
    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    config.onDoneClick();

    expect(mockCreateRequest).toHaveBeenCalledTimes(1);
    expect(mockDriverInstance.destroy).toHaveBeenCalledTimes(1);
    expect(fireTourConfetti).toHaveBeenCalledTimes(1);

    // A late onDestroyed must not double-post nor re-fire
    config.onDestroyed();
    expect(mockCreateRequest).toHaveBeenCalledTimes(1);
    expect(fireTourConfetti).toHaveBeenCalledTimes(1);
  });
});

describe("useGuidedTour — tab switching", () => {
  test("switches to the destination tab before moving forward", async () => {
    mountTourTargets();
    const { tour, setActiveTab } = makeTour();
    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    // With the welcome card at index 0, "Nueva Minuta" (requires the
    // legal-documents tab) sits at index 3; moving from 2 must switch.
    mockDriverInstance.getActiveIndex.mockReturnValue(2);
    config.onNextClick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setActiveTab).toHaveBeenCalledWith("legal-documents");
    expect(mockDriverInstance.moveNext).toHaveBeenCalledTimes(1);
    expect(setActiveTab.mock.invocationCallOrder[0]).toBeLessThan(
      mockDriverInstance.moveNext.mock.invocationCallOrder[0],
    );
  });

  test("moves back without switching when the previous step has no tab", async () => {
    mountTourTargets();
    const { tour, setActiveTab } = makeTour();
    await tour.startTour();

    const config = mockDriver.mock.calls[0][0];
    // Moving from the first content step back to the welcome card —
    // neither carries tab metadata.
    mockDriverInstance.getActiveIndex.mockReturnValue(1);
    config.onPrevClick();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setActiveTab).not.toHaveBeenCalled();
    expect(mockDriverInstance.movePrevious).toHaveBeenCalledTimes(1);
  });
});
