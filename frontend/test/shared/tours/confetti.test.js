import { fireTourConfetti, TOUR_CONFETTI_COLORS } from "@/shared/tours/confetti";
import confetti from "canvas-confetti";

jest.mock("canvas-confetti", () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe("fireTourConfetti", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("fires two mirrored bursts and a delayed center burst", () => {
    fireTourConfetti();

    expect(confetti).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(250);
    expect(confetti).toHaveBeenCalledTimes(3);
  });

  test("uses the brand palette and the reduced-motion library guard", () => {
    fireTourConfetti();

    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        colors: TOUR_CONFETTI_COLORS,
        disableForReducedMotion: true,
      }),
    );
  });

  test("does nothing under prefers-reduced-motion", () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });

    fireTourConfetti();
    jest.advanceTimersByTime(250);

    expect(confetti).not.toHaveBeenCalled();
  });

  test("never throws when the library fails", () => {
    confetti.mockImplementation(() => {
      throw new Error("canvas unavailable");
    });

    expect(() => fireTourConfetti()).not.toThrow();
    expect(() => jest.advanceTimersByTime(250)).not.toThrow();
  });
});
