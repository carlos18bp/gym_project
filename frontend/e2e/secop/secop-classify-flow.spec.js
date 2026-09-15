import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installSecopApiMocks, MOCK_PROCESS_DETAIL } from "./secopMocks.js";

const LAWYER_AUTH = {
  token: "e2e-secop-token",
  userAuth: {
    id: 9901,
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
  },
};

test.describe("SECOP Classify Flows", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page);
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  // Catches: a "Clasificar" button that opens the modal but whose Guardar
  // never actually persists the classification (a save that is a no-op) —
  // a regression here leaves the sidebar showing "Aún no has clasificado"
  // and this test fails on the missing badge/notes text.
  test("lawyer can classify a SECOP process from detail view", {
    tag: ['@flow:secop-classify-process', '@module:secop', '@priority:P2', '@role:lawyer', '@outcome:success'],
  }, async ({ page }) => {
    // Ministerio de Transporte (id 9001) starts unclassified for this test;
    // override the shared detail/create-classification mocks so the refetch
    // after saving reflects the classification that was actually submitted.
    let savedClassification = null;
    await page.route("**/api/secop/processes/9001/", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...MOCK_PROCESS_DETAIL,
          classifications: savedClassification ? [savedClassification] : [],
        }),
      });
    });
    await page.route("**/api/secop/classifications/", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      const payload = route.request().postDataJSON?.() || {};
      savedClassification = {
        id: 4501,
        user: { id: 9901, first_name: "E2E", last_name: "Lawyer" },
        status: payload.status,
        notes: payload.notes,
        is_mine: true,
        created_at: "2026-03-20T09:00:00Z",
        updated_at: "2026-03-20T09:00:00Z",
      };
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: savedClassification.id,
          process: payload.process,
          status: savedClassification.status,
          notes: savedClassification.notes,
          created_at: savedClassification.created_at,
          updated_at: savedClassification.updated_at,
        }),
      });
    });

    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Navigate to detail
    await page.getByText("Ministerio de Transporte").click();
    await expect(page).toHaveURL(/\/secop\/\d+/);

    // Classify it for real: pick a status, add a note, save
    await page.getByTestId("detail-classify-btn").click();
    await page.getByTestId("classification-status-APPLIED").click();
    await page.getByTestId("classification-notes").fill("Cumple los requisitos, aplicar antes del cierre");
    await page.getByTestId("classification-save").click();

    // The modal closes and the sidebar now reflects the saved classification.
    // Scoped to the "Mi Clasificación" panel: the same classification also
    // renders under "Clasificaciones del Equipo", so an unscoped badge lookup
    // is ambiguous (strict-mode violation).
    await expect(page.getByTestId("classification-modal")).toHaveCount(0);
    const myClassificationPanel = page.getByTestId("detail-classification");
    await expect(myClassificationPanel.getByTestId("classification-badge-APPLIED")).toHaveText("Aplicado");
    await expect(myClassificationPanel).toContainText(
      "Cumple los requisitos, aplicar antes del cierre"
    );
  });

  test("lawyer can view My Classifications tab with classified processes", {
    tag: ['@flow:secop-classify-process', '@module:secop', '@priority:P2', '@role:lawyer', '@outcome:display'],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Switch to My Classifications tab
    const myClassTab = page.getByTestId("tab-classified");
    await expect(myClassTab).toBeVisible();
    await myClassTab.click();
    // Should show classified processes
    await expect(page.getByText("Alcaldía de Medellín")).toBeVisible();
  });

  // Catches: an Editar/Guardar path that updates the status but drops or
  // ignores the notes textarea — the old note would keep rendering, or no
  // note would render at all, and this test fails on either.
  test("lawyer can add notes to a classification", {
    tag: ['@flow:secop-add-notes', '@module:secop', '@priority:P3', '@role:lawyer', '@outcome:success'],
  }, async ({ page }) => {
    // Ministerio de Transporte (id 9001) already has a classification with
    // notes "Revisar con equipo" (from the shared MOCK_PROCESS_DETAIL).
    // Override the detail/create-classification mocks so the refetch after
    // saving reflects whatever note was actually submitted.
    let notes = "Revisar con equipo";
    await page.route("**/api/secop/processes/9001/", async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...MOCK_PROCESS_DETAIL,
          classifications: [
            {
              id: 1,
              user: { id: 9901, first_name: "E2E", last_name: "Lawyer" },
              status: "INTERESTING",
              notes,
              is_mine: true,
              created_at: "2026-03-15T10:00:00Z",
              updated_at: "2026-03-15T10:00:00Z",
            },
          ],
        }),
      });
    });
    await page.route("**/api/secop/classifications/", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      const payload = route.request().postDataJSON?.() || {};
      notes = payload.notes;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          process: payload.process,
          status: payload.status,
          notes,
          created_at: "2026-03-15T10:00:00Z",
          updated_at: "2026-03-20T09:05:00Z",
        }),
      });
    });

    await page.goto("/secop");
    await expect(page.getByTestId("secop-table")).toBeVisible();

    // Navigate to detail of a process with an existing classification
    await page.getByText("Ministerio de Transporte").click();
    await expect(page).toHaveURL(/\/secop\/\d+/);
    await expect(page.getByTestId("detail-classification")).toContainText("Revisar con equipo");

    // Replace the note for real
    await page.getByTestId("detail-edit-classification").click();
    await page.getByTestId("classification-notes").fill("Prioridad alta, contactar al cliente antes del viernes");
    await page.getByTestId("classification-save").click();

    await expect(page.getByTestId("classification-modal")).toHaveCount(0);
    await expect(page.getByTestId("detail-classification")).toContainText(
      "Prioridad alta, contactar al cliente antes del viernes"
    );
    await expect(page.getByTestId("detail-classification")).not.toContainText("Revisar con equipo");
  });
});
