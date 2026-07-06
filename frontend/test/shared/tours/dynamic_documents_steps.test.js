import {
  getTourSteps,
  MODULE_NAME,
  CONFIRM_MESSAGE,
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

describe("tour registry", () => {
  it("resolves the dynamic_documents module config", () => {
    const config = getTourConfig(MODULE_NAME);

    expect(config).not.toBeNull();
    expect(config.getSteps).toBe(getTourSteps);
    expect(config.confirmMessage).toBe(CONFIRM_MESSAGE);
  });

  it("returns null for unregistered modules", () => {
    expect(getTourConfig("unknown_module")).toBeNull();
  });

  it("registers dynamic_documents as the only module for now", () => {
    expect(Object.keys(tourRegistry)).toEqual([MODULE_NAME]);
  });
});
