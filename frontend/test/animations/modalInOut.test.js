import { gsap } from "gsap";

import { fadeInModal, fadeOutModal } from "@/animations/modalInOut";

jest.mock("gsap", () => ({
  __esModule: true,
  gsap: {
    fromTo: jest.fn(),
    to: jest.fn(),
  },
}));

describe("modalInOut.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("fadeInModal calls gsap.fromTo with expected params", () => {
    const el = document.createElement("div");

    fadeInModal(el);

    expect(gsap.fromTo).toHaveBeenCalledWith(
      el,
      { opacity: 0 },
      { opacity: 1, duration: 0.5, ease: "power2.out" }
    );
  });

  test("fadeOutModal calls gsap.to with expected params", () => {
    const el = document.createElement("div");
    const onComplete = jest.fn();

    fadeOutModal(el, onComplete);

    expect(gsap.to).toHaveBeenCalledWith(el, {
      opacity: 0,
      duration: 0.4,
      ease: "power2.in",
      onComplete,
    });
  });
});
