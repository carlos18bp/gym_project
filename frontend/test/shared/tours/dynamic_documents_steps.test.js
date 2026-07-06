import {
  getTourSteps,
  MODULE_NAME,
  CONFIRM_MESSAGE,
  EYEBROW_LABEL,
  WELCOME_STEP,
  FINAL_STEP,
} from "@/shared/tours/dynamic_documents_steps";
import { getTourConfig, tourRegistry } from "@/shared/tours";

describe("dynamic_documents_steps — step lists", () => {
  it("returns 10 base steps for lawyers", () => {
    expect(getTourSteps("lawyer")).toHaveLength(10);
  });

  it("returns the lawyer tour for admins", () => {
    expect(getTourSteps("admin")).toEqual(getTourSteps("lawyer"));
  });

  it("returns 7 base steps for clients", () => {
    expect(getTourSteps("client")).toHaveLength(7);
  });

  it("returns the client tour for basic users", () => {
    expect(getTourSteps("basic")).toEqual(getTourSteps("client"));
  });

  it("returns the client tour for corporate clients", () => {
    expect(getTourSteps("corporate_client")).toEqual(getTourSteps("client"));
  });
});

describe("dynamic_documents_steps — conditional pending-signatures step", () => {
  it("appends an extra closing step when the user has pending signatures", () => {
    const steps = getTourSteps("lawyer", { hasPendingSignatures: true });

    expect(steps).toHaveLength(11);
    const lastStep = steps[steps.length - 1];
    expect(lastStep.target).toBe('[data-tour="tab-pending-signatures"]');
    expect(lastStep.tab).toBe("pending-signatures");
  });

  it("appends the same closing step for clients", () => {
    const steps = getTourSteps("client", { hasPendingSignatures: true });

    expect(steps).toHaveLength(8);
    expect(steps[steps.length - 1].tab).toBe("pending-signatures");
  });
});

describe("dynamic_documents_steps — step shape", () => {
  const allSteps = [
    ...getTourSteps("lawyer", { hasPendingSignatures: true }),
    ...getTourSteps("client"),
  ];

  it("uses stable data-tour selectors for every target", () => {
    allSteps.forEach((step) => {
      expect(step.target).toMatch(/^\[data-tour="[a-z-]+"\]$/);
    });
  });

  it("provides a Spanish title and description on every popover", () => {
    allSteps.forEach((step) => {
      expect(step.popover.title).toBeTruthy();
      expect(step.popover.description).toBeTruthy();
    });
  });

  it("marks individual tab-button steps as desktop-only", () => {
    getTourSteps("lawyer")
      .filter((step) => step.target.startsWith('[data-tour="tab-'))
      .forEach((step) => {
        expect(step.desktopOnly).toBe(true);
      });
  });

  it("keeps the tabs overview and action buttons available on mobile", () => {
    const clientSteps = getTourSteps("client");
    const mobileSteps = clientSteps.filter((step) => !step.desktopOnly);

    expect(mobileSteps.map((step) => step.target)).toEqual([
      '[data-tour="tabs-nav"]',
      '[data-tour="btn-new-document"]',
      '[data-tour="btn-electronic-signature"]',
    ]);
  });
});

describe("welcome and closing cards", () => {
  it("defines an element-less welcome card with its own CTA", () => {
    expect(WELCOME_STEP.target).toBeNull();
    expect(WELCOME_STEP.popover.title).toBe("Bienvenido a Archivos Jurídicos");
    expect(WELCOME_STEP.popover.nextBtnText).toBe("Comenzar recorrido");
    expect(WELCOME_STEP.desktopOnly).toBe(false);
  });

  it("closes the tour on the permanent help button", () => {
    expect(FINAL_STEP.target).toBe('[data-tour="help-button"]');
    expect(FINAL_STEP.popover.doneBtnText).toBe("Entendido");
    expect(FINAL_STEP.popover.description).toContain(
      "puedes repetir esta guía cuando quieras",
    );
    expect(FINAL_STEP.desktopOnly).toBe(false);
  });

  it("keeps the framing cards out of the content step lists", () => {
    // The mandated 10/7 counts must never include welcome/finale.
    expect(getTourSteps("lawyer")).not.toContain(WELCOME_STEP);
    expect(getTourSteps("lawyer")).not.toContain(FINAL_STEP);
  });
});

describe("tour registry", () => {
  it("resolves the dynamic_documents module config", () => {
    const config = getTourConfig(MODULE_NAME);

    expect(config).not.toBeNull();
    expect(config.getSteps).toBe(getTourSteps);
    expect(config.confirmMessage).toBe(CONFIRM_MESSAGE);
    expect(config.eyebrow).toBe(EYEBROW_LABEL);
    expect(config.intro).toBe(WELCOME_STEP);
    expect(config.finale).toBe(FINAL_STEP);
  });

  it("returns null for unregistered modules", () => {
    expect(getTourConfig("unknown_module")).toBeNull();
  });

  it("registers dynamic_documents as the only module for now", () => {
    expect(Object.keys(tourRegistry)).toEqual([MODULE_NAME]);
  });
});
