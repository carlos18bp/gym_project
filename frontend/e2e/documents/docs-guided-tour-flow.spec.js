import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks } from "../helpers/dynamicDocumentMocks.js";
import { DOCS_GUIDED_TOUR } from "../helpers/flow-tags.js";

/**
 * E2E for docs-guided-tour (Req #4 — Tour Guiado / Onboarding Interactivo).
 *
 * Exercises the driver.js guided tour of the Archivos Jurídicos dashboard:
 * welcome card, tab auto-switching, per-content-step progress, skip paths,
 * help-button finale with completion POST, manual relaunch via the "?"
 * button (with its attention ping) and the 30-day stale re-offer.
 */

const TOUR_POPOVER = ".driver-popover";
const TITLE = ".driver-popover-title";
const NEXT_BTN = ".driver-popover-next-btn";
const PROGRESS = ".driver-popover-progress-text";
const HELP_PING = '[data-testid="tour-help-ping"]';

async function loginTo(page, { userId, role, tourStatus }) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role,
    hasSignature: true,
    tourStatus,
  });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role,
      is_gym_lawyer: role === "lawyer",
      is_profile_completed: true,
    },
  });
  await page.goto("/dynamic_document_dashboard");
}

function waitForCompletionPost(page) {
  return page.waitForRequest(
    (request) =>
      request.url().includes("/api/tour-progress/complete/") &&
      request.method() === "POST",
  );
}

async function passWelcomeCard(page) {
  await expect(page.locator(TOUR_POPOVER)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(TITLE)).toHaveText("Bienvenido a Archivos Jurídicos");
  await expect(page.locator(PROGRESS)).toBeHidden();
  await expect(page.locator(NEXT_BTN)).toHaveText("Comenzar recorrido");
  await page.locator(NEXT_BTN).click();
}

test(
  "lawyer first visit auto-starts the tour, switches tabs and posts completion",
  { tag: [...DOCS_GUIDED_TOUR, "@role:lawyer"] },
  async ({ page }) => {
    await loginTo(page, { userId: 9301, role: "lawyer", tourStatus: "never" });

    // Attention ping while the guide is due
    await expect(page.locator(HELP_PING)).toBeVisible({ timeout: 15_000 });

    await passWelcomeCard(page);
    await expect(page.locator(TITLE)).toHaveText("Pestañas de navegación");
    await expect(page.locator(PROGRESS)).toHaveText("Paso 1 de 10");

    // Advance to step 5 ("Nuevo Documento"), which lives in the
    // my-documents tab: the tour must switch the active tab by itself.
    const stepTitles = [
      "Minutas",
      "Nueva Minuta",
      "Mis Documentos",
      "Nuevo Documento",
    ];
    for (const title of stepTitles) {
      await page.locator(NEXT_BTN).click();
      await expect(page.locator(TITLE)).toHaveText(title);
    }
    // The highlighted element is the desktop "Nuevo Documento" button,
    // which only renders while the my-documents tab is active.
    await expect(
      page.locator('[data-tour="btn-new-document"].driver-active-element'),
    ).toBeVisible();

    // Finish the remaining content steps (assert progress between clicks
    // so each async tab switch settles).
    for (let step = 6; step <= 10; step++) {
      await page.locator(NEXT_BTN).click();
      await expect(page.locator(PROGRESS)).toHaveText(`Paso ${step} de 10`);
    }

    // Functional finale: the tour ends on the "?" help button
    await page.locator(NEXT_BTN).click();
    await expect(page.locator(TITLE)).toHaveText("Hasta aquí el recorrido");
    await expect(
      page.locator('[data-testid="tour-help-button"].driver-active-element'),
    ).toBeVisible();
    await expect(page.locator(PROGRESS)).toBeHidden();
    await expect(page.locator(NEXT_BTN)).toHaveText("Entendido");

    const completionPost = waitForCompletionPost(page);
    await page.locator(NEXT_BTN).click();
    await completionPost;
    await expect(page.locator(TOUR_POPOVER)).toHaveCount(0);

    // Completion clears the attention ping
    await expect(page.locator(HELP_PING)).toHaveCount(0);
  },
);

test(
  "skipping the tour closes it and still registers completion",
  { tag: [...DOCS_GUIDED_TOUR, "@role:lawyer"] },
  async ({ page }) => {
    await loginTo(page, { userId: 9302, role: "lawyer", tourStatus: "never" });

    await passWelcomeCard(page);
    await expect(page.locator(PROGRESS)).toHaveText("Paso 1 de 10");

    const completionPost = waitForCompletionPost(page);
    await page.getByRole("button", { name: "Omitir guía" }).click();
    await completionPost;
    await expect(page.locator(TOUR_POPOVER)).toHaveCount(0);
  },
);

test(
  "declining the welcome card with Ahora no registers completion",
  { tag: [...DOCS_GUIDED_TOUR, "@role:lawyer"] },
  async ({ page }) => {
    await loginTo(page, { userId: 9307, role: "lawyer", tourStatus: "never" });

    await expect(page.locator(TOUR_POPOVER)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(TITLE)).toHaveText(
      "Bienvenido a Archivos Jurídicos",
    );

    const completionPost = waitForCompletionPost(page);
    await page.getByRole("button", { name: "Ahora no" }).click();
    await completionPost;
    await expect(page.locator(TOUR_POPOVER)).toHaveCount(0);
  },
);

test(
  "recent completion suppresses auto-start but the help button relaunches",
  { tag: [...DOCS_GUIDED_TOUR, "@role:lawyer"] },
  async ({ page }) => {
    await loginTo(page, { userId: 9303, role: "lawyer", tourStatus: "recent" });

    await expect(
      page.locator('[data-testid="lawyer-tab-legal-documents"]'),
    ).toBeVisible({ timeout: 15_000 });
    // Give the auto-start window time to (not) fire — a bounded wait is the
    // only way to assert non-occurrence. quality: disable wait_for_timeout (bounded window is the only way to assert the tour does NOT auto-start)
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(1500);
    await expect(page.locator(TOUR_POPOVER)).toHaveCount(0);
    // No attention ping when the guide was completed recently
    await expect(page.locator(HELP_PING)).toHaveCount(0);

    await page.locator('[data-testid="tour-help-button"]').click();
    await expect(page.locator(TOUR_POPOVER)).toBeVisible();
    await expect(page.locator(TITLE)).toHaveText(
      "Bienvenido a Archivos Jurídicos",
    );
  },
);

test(
  "stale completion re-offers the tour via confirmation modal",
  { tag: [...DOCS_GUIDED_TOUR, "@role:lawyer"] },
  async ({ page }) => {
    await loginTo(page, { userId: 9304, role: "lawyer", tourStatus: "stale" });

    const modal = page.locator('[class~="swal2-popup"]');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal).toContainText(
      "¿Quieres ver la guía del módulo de Archivos Jurídicos?",
    );
    const confirmButton = page.getByRole("button", { name: "Ver la guía" });
    await expect(confirmButton).toBeVisible();

    await confirmButton.click();
    await expect(page.locator(TOUR_POPOVER)).toBeVisible();
    await expect(page.locator(TITLE)).toHaveText(
      "Bienvenido a Archivos Jurídicos",
    );
  },
);

test(
  "client first visit gets the 7-step client tour",
  { tag: [...DOCS_GUIDED_TOUR, "@role:client"] },
  async ({ page }) => {
    await loginTo(page, { userId: 9305, role: "client", tourStatus: "never" });

    await passWelcomeCard(page);
    await expect(page.locator(PROGRESS)).toHaveText("Paso 1 de 7");

    for (let step = 2; step <= 7; step++) {
      await page.locator(NEXT_BTN).click();
      await expect(page.locator(PROGRESS)).toHaveText(`Paso ${step} de 7`);
    }

    await page.locator(NEXT_BTN).click();
    await expect(page.locator(TITLE)).toHaveText("Hasta aquí el recorrido");
    await expect(page.locator(NEXT_BTN)).toHaveText("Entendido");

    const completionPost = waitForCompletionPost(page);
    await page.locator(NEXT_BTN).click();
    await completionPost;
    await expect(page.locator(TOUR_POPOVER)).toHaveCount(0);
  },
);

test(
  "mobile viewport gets a shorter tour without the collapsed tab steps",
  { tag: [...DOCS_GUIDED_TOUR, "@role:client"] },
  async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginTo(page, { userId: 9306, role: "client", tourStatus: "never" });

    await passWelcomeCard(page);
    // Individual tab steps are desktop-only: tabs overview + Nuevo
    // Documento + Firma Electrónica remain.
    await expect(page.locator(PROGRESS)).toHaveText("Paso 1 de 3");

    for (let step = 2; step <= 3; step++) {
      await page.locator(NEXT_BTN).click();
      await expect(page.locator(PROGRESS)).toHaveText(`Paso ${step} de 3`);
    }

    // The help-button finale also works on mobile (hero header is
    // always rendered).
    await page.locator(NEXT_BTN).click();
    await expect(page.locator(TITLE)).toHaveText("Hasta aquí el recorrido");
    await expect(
      page.locator('[data-testid="tour-help-button"].driver-active-element'),
    ).toBeVisible();
    await expect(page.locator(NEXT_BTN)).toHaveText("Entendido");
  },
);
