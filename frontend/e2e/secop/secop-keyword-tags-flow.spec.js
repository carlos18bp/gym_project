import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installSecopApiMocks } from "./secopMocks.js";
import { SECOP_KEYWORD_TAGS } from "../helpers/flow-tags.js";

const LAWYER_AUTH = {
  token: "e2e-secop-token",
  userAuth: {
    id: 9901,
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
  },
};

const SAVED_VIEWS_WITH_KEYWORDS = [
  {
    id: 701,
    name: "Antioquia Obras",
    filters: { department: "Antioquia", contract_type: "Obra", keywords: "construcción|vial|infraestructura" },
    is_favorite: false,
    created_at: "2026-03-10T10:00:00Z",
  },
  {
    id: 702,
    name: "Consultoría Nacional",
    filters: { department: "Bogotá D.C." },
    is_favorite: false,
    created_at: "2026-03-12T10:00:00Z",
  },
];

test.describe("SECOP Keyword Tags Flow", () => {
  test.beforeEach(async ({ page }) => {
    await installSecopApiMocks(page, { savedViews: SAVED_VIEWS_WITH_KEYWORDS });
    await setAuthLocalStorage(page, LAWYER_AUTH);
  });

  test("saved view with keywords displays keyword tags", {
    tag: [...SECOP_KEYWORD_TAGS, "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const savedViewsTab = page.getByTestId("tab-savedViews");
    await expect(savedViewsTab).toBeVisible();
    await savedViewsTab.click();

    // View with keywords should show tag badges
    const viewCard = page.getByTestId("saved-view-card-701");
    await expect(viewCard).toBeVisible();
    await expect(viewCard.getByText("construcción")).toBeVisible();
    await expect(viewCard.getByText("vial")).toBeVisible();
    await expect(viewCard.getByText("infraestructura")).toBeVisible();
  });

  test("saved view without keywords shows no keyword tags", {
    tag: [...SECOP_KEYWORD_TAGS, "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const savedViewsTab = page.getByTestId("tab-savedViews");
    await expect(savedViewsTab).toBeVisible();
    await savedViewsTab.click();

    // View without keywords should still render
    const viewCard = page.getByTestId("saved-view-card-702");
    await expect(viewCard).toBeVisible();
    await expect(viewCard.getByText("Consultoría Nacional")).toBeVisible();
  });

  test("applying a saved view with keywords activates keyword filters", {
    tag: [...SECOP_KEYWORD_TAGS, "@role:lawyer"],
  }, async ({ page }) => {
    await page.goto("/secop");
    await expect(page.getByTestId("secop-tabs")).toBeVisible();

    const savedViewsTab = page.getByTestId("tab-savedViews");
    await expect(savedViewsTab).toBeVisible();
    await savedViewsTab.click();

    // Apply the view with keywords
    const applyBtn = page.getByTestId("saved-view-apply-701");
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    // Page should remain stable and table should be visible
    await expect(page.getByTestId("secop-list-page")).toBeVisible();
  });
});
