import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks } from "../helpers/dynamicDocumentMocks.js";
import { DOCS_GUIDED_TOUR } from "../helpers/flow-tags.js";

/**
 * E2E for docs-guided-tour (Req #4 — Tour Guiado / Onboarding Interactivo).
 *
 * Exercises the driver.js guided tour of the Archivos Jurídicos dashboard:
 * auto-start on first visit, tab auto-switching, skip, completion POST,
 * manual relaunch via the "?" help button and the 30-day stale re-offer.
 */

const TOUR_POPOVER = ".driver-popover";
const NEXT_BTN = ".driver-popover-next-btn";
const PROGRESS = ".driver-popover-progress-text";

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

test(
  "lawyer first visit auto-starts the tour, switches tabs and posts completion",
  { tag: [...DOCS_GUIDED_TOUR, "@role:lawyer"] },
  async ({ page }) => {
    await loginTo(page, { userId: 9301, role: "lawyer", tourStatus: "never" });

    // Auto-start after page load (composable delays ~500ms)
    await expect(page.locator(TOUR_POPOVER)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".driver-popover-title")).toHaveText(
      "Pestañas de navegación",
    );
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
      await expect(page.locator(".driver-popover-title")).toHaveText(title);
    }
    // The highlighted element is the desktop "Nuevo Documento" button,
    // which only renders while the my-documents tab is active.
    await expect(
      page.locator('[data-tour="btn-new-document"].driver-active-element'),
    ).toBeVisible();

    // Finish the remaining steps (assert progress between clicks so each
    // async tab switch settles); the last button reads "Finalizar".
    for (let step = 6; step <= 10; step++) {
      await page.locator(NEXT_BTN).click();
      await expect(page.locator(PROGRESS)).toHaveText(`Paso ${step} de 10`);
    }
    await expect(page.locator(NEXT_BTN)).toHaveText("Finalizar");

    const completionPost = waitForCompletionPost(page);
    await page.locator(NEXT_BTN).click();
    await completionPost;
    await expect(page.locator(TOUR_POPOVER)).toHaveCount(0);
  },
);

test(
  "skipping the tour closes it and still registers completion",
  { tag: [...DOCS_GUIDED_TOUR, "@role:lawyer"] },
  async ({ page }) => {
    await loginTo(page, { userId: 9302, role: "lawyer", tourStatus: "never" });

    await expect(page.locator(TOUR_POPOVER)).toBeVisible({ timeout: 15_000 });

    const completionPost = waitForCompletionPost(page);
    await page.getByRole("button", { name: "Omitir guía" }).click();
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
    // Give the auto-start window time to (not) fire
    await page.waitForTimeout(1500);
    await expect(page.locator(TOUR_POPOVER)).toHaveCount(0);

    await page.locator('[data-testid="tour-help-button"]').click();
    await expect(page.locator(TOUR_POPOVER)).toBeVisible();
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

    await page.locator(".swal2-confirm").click();
    await expect(page.locator(TOUR_POPOVER)).toBeVisible();
  },
);

test(
  "client first visit gets the 7-step client tour",
  { tag: [...DOCS_GUIDED_TOUR, "@role:client"] },
  async ({ page }) => {
    await loginTo(page, { userId: 9305, role: "client", tourStatus: "never" });

    await expect(page.locator(TOUR_POPOVER)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(PROGRESS)).toHaveText("Paso 1 de 7");

    for (let step = 2; step <= 7; step++) {
      await page.locator(NEXT_BTN).click();
      await expect(page.locator(PROGRESS)).toHaveText(`Paso ${step} de 7`);
    }
    await expect(page.locator(NEXT_BTN)).toHaveText("Finalizar");

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

    await expect(page.locator(TOUR_POPOVER)).toBeVisible({ timeout: 15_000 });
    // Individual tab steps are desktop-only: tabs overview + Nuevo
    // Documento + Firma Electrónica remain.
    await expect(page.locator(PROGRESS)).toHaveText("Paso 1 de 3");
  },
);
