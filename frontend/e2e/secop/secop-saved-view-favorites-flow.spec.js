import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installSecopApiMocks } from "./secopMocks.js";
import { SECOP_SAVED_VIEW_FAVORITES } from "../helpers/flow-tags.js";

const LAWYER_AUTH = {
  token: "e2e-secop-token",
  userAuth: {
    id: 9901,
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
  },
};

const SAVED_VIEWS_WITH_FAVORITE = [
  {
    id: 701,
    name: "Antioquia Obras",
    filters: { department: "Antioquia", contract_type: "Obra" },
    is_favorite: true,
    keywords: "",
    created_at: "2026-03-10T10:00:00Z",
  },
  {
    id: 702,
    name: "Bogotá Consultoría",
    filters: { department: "Bogotá D.C.", contract_type: "Consultoría" },
    is_favorite: false,
    keywords: "",
    created_at: "2026-03-12T10:00:00Z",
  },
];

test.describe("SECOP Saved View Favorites Flow", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page, { savedViews: SAVED_VIEWS_WITH_FAVORITE });
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  test("favorite saved view shows star icon filled", {
    tag: [...SECOP_SAVED_VIEW_FAVORITES, "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const savedViewsTab = page.getByTestId("tab-savedViews");
    await expect(savedViewsTab).toBeVisible();
    await savedViewsTab.click();

    // Favorite view card should be visible
    await expect(page.getByTestId("saved-view-card-701")).toBeVisible();

    // Favorite toggle button should exist with correct tooltip
    const favoriteBtn = page.getByTestId("saved-view-favorite-701");
    await expect(favoriteBtn).toBeVisible();
    await expect(favoriteBtn).toHaveAttribute("title", "Quitar como filtro por defecto");
  });

  test("non-favorite saved view shows outline star", {
    tag: [...SECOP_SAVED_VIEW_FAVORITES, "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const savedViewsTab = page.getByTestId("tab-savedViews");
    await expect(savedViewsTab).toBeVisible();
    await savedViewsTab.click();

    // Non-favorite view card
    await expect(page.getByTestId("saved-view-card-702")).toBeVisible();

    const favoriteBtn = page.getByTestId("saved-view-favorite-702");
    await expect(favoriteBtn).toBeVisible();
    await expect(favoriteBtn).toHaveAttribute("title", "Usar como filtro por defecto");
  });

  test("lawyer can toggle favorite on a saved view", {
    tag: [...SECOP_SAVED_VIEW_FAVORITES, "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const savedViewsTab = page.getByTestId("tab-savedViews");
    await expect(savedViewsTab).toBeVisible();
    await savedViewsTab.click();

    // Click the favorite toggle on the non-favorite view
    const favoriteBtn = page.getByTestId("saved-view-favorite-702");
    await expect(favoriteBtn).toBeVisible();
    await favoriteBtn.click();

    // Page should remain stable after toggle
    await expect(page.getByTestId("secop-list-page")).toBeVisible();
  });
});
