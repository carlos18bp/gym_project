import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installSecopApiMocks } from "./secopMocks.js";

const UNSPSC_CONSULTING_SERVICES = '72101500';

const LAWYER_AUTH = {
  token: "e2e-secop-token",
  userAuth: {
    id: 9901,
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
  },
};

const SAVED_VIEWS_FOR_EDIT = [
  {
    id: 701,
    name: "Antioquia Obras",
    filters: { department: "Antioquia", contract_type: "Obra" },
    is_favorite: false,
    keywords: "",
    created_at: "2026-03-10T10:00:00Z",
  },
];

test.describe("SECOP Edit Saved View Flow", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page, { savedViews: SAVED_VIEWS_FOR_EDIT });
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  test("lawyer can open edit modal for an existing saved view", {
    tag: ['@flow:secop-edit-saved-view', '@module:secop', '@priority:P3', '@role:lawyer'],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    await page.getByTestId("tab-savedViews").click();
    await expect(page.getByTestId("saved-view-card-701")).toBeVisible();

    // Clicking the card opens the edit modal
    await page.getByTestId("saved-view-card-701").click();
    await expect(page.getByTestId("saved-view-modal")).toBeVisible();

    // Modal is in edit mode — title says "Editar Filtros"
    await expect(page.getByTestId("saved-view-modal-title")).toHaveText("Editar Filtros");

    // Name field is pre-filled with existing view name
    await expect(page.getByTestId("saved-view-modal-name")).toHaveValue("Antioquia Obras");
  });

  test("lawyer can rename a saved view and save it", {
    tag: ['@flow:secop-edit-saved-view', '@module:secop', '@priority:P3', '@role:lawyer'],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    await page.getByTestId("tab-savedViews").click();
    await expect(page.getByTestId("saved-view-card-701")).toBeVisible();

    await page.getByTestId("saved-view-card-701").click();
    await expect(page.getByTestId("saved-view-modal")).toBeVisible();

    // Clear and update the name
    await page.getByTestId("saved-view-modal-name").clear();
    await page.getByTestId("saved-view-modal-name").fill("Antioquia Obras Updated");

    // Save — button says "Actualizar" in edit mode
    await page.getByTestId("saved-view-modal-save").click();

    // Modal closes after successful save
    await expect(page.getByTestId("saved-view-modal")).not.toBeVisible();

    // Saved views list remains visible
    await expect(page.getByTestId("saved-views-list")).toBeVisible();
  });

  test("lawyer can update UNSPSC code field in edit modal", {
    tag: ['@flow:secop-edit-saved-view', '@module:secop', '@priority:P3', '@role:lawyer'],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    await page.getByTestId("tab-savedViews").click();
    await expect(page.getByTestId("saved-view-card-701")).toBeVisible();

    await page.getByTestId("saved-view-card-701").click();
    await expect(page.getByTestId("saved-view-modal")).toBeVisible();

    // UNSPSC field is a text input in the modal
    const unspscField = page.getByTestId("saved-view-filter-unspsc");
    await expect(unspscField).toBeVisible();

    // Enter a UNSPSC code
    await unspscField.fill(UNSPSC_CONSULTING_SERVICES);

    // Save the updated view
    await page.getByTestId("saved-view-modal-save").click();
    await expect(page.getByTestId("saved-view-modal")).not.toBeVisible();
  });

  test("lawyer can cancel edit without saving changes", {
    tag: ['@flow:secop-edit-saved-view', '@module:secop', '@priority:P3', '@role:lawyer'],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    await page.getByTestId("tab-savedViews").click();
    await expect(page.getByTestId("saved-view-card-701")).toBeVisible();

    await page.getByTestId("saved-view-card-701").click();
    await expect(page.getByTestId("saved-view-modal")).toBeVisible();

    // Modify name then cancel
    await page.getByTestId("saved-view-modal-name").fill("Should Not Save");
    await page.getByTestId("saved-view-modal-cancel").click();

    // Modal closes without saving
    await expect(page.getByTestId("saved-view-modal")).not.toBeVisible();

    // Original view card is still shown
    await expect(page.getByTestId("saved-views-list")).toBeVisible();
  });
});
