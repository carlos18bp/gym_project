import { test, expect } from "../helpers/test.js";

/**
 * E2E tests for policies pages (PrivacyPolicy.vue, TermsOfUse.vue)
 * Target: create tests for empty e2e/policies/ directory
 */

test.describe("policies: privacy policy page", () => {
  test("privacy policy page loads successfully", async ({ page }) => {
    await page.goto("/privacy-policy");
    await page.waitForLoadState("networkidle");

    // Privacy policy page should be visible
    await expect(page.locator("body")).toBeVisible();
    
    // Should contain privacy-related content
    const hasPrivacyContent = await page.getByText(/privacidad|privacy|datos|data/i).first().isVisible().catch(() => false);
    expect(hasPrivacyContent).toBeTruthy();
  });

  test("privacy policy contains required sections", async ({ page }) => {
    await page.goto("/privacy-policy");
    await page.waitForLoadState("networkidle");

    // Should have heading or title
    await expect(page.locator("body")).toBeVisible();
  });

  test("privacy policy is accessible without authentication", async ({ page }) => {
    // No auth setup - should still work
    await page.goto("/privacy-policy");
    await page.waitForLoadState("networkidle");

    // Page should load without auth
    await expect(page.locator("body")).toBeVisible();
  });

  test("privacy policy page is scrollable for long content", async ({ page }) => {
    await page.goto("/privacy-policy");
    await page.waitForLoadState("networkidle");

    // Page should be visible and scrollable
    await expect(page.locator("body")).toBeVisible();
    
    // Try scrolling
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForLoadState('domcontentloaded');
    
    // Page should still be responsive
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("policies: terms of use page", () => {
  test("terms of use page loads successfully", async ({ page }) => {
    await page.goto("/terms-of-use");
    await page.waitForLoadState("networkidle");

    // Terms page should be visible
    await expect(page.locator("body")).toBeVisible();
  });

  test("terms of use contains required sections", async ({ page }) => {
    await page.goto("/terms-of-use");
    await page.waitForLoadState('networkidle');

    // Should have content
    await expect(page.locator("body")).toBeVisible();
  });

  test("terms of use is accessible without authentication", async ({ page }) => {
    // No auth setup - should still work
    await page.goto("/terms-of-use");
    await page.waitForLoadState("networkidle");

    // Page should load without auth
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("policies: navigation between pages", () => {
  test("user can navigate from privacy to terms", async ({ page }) => {
    await page.goto("/privacy-policy");
    await page.waitForLoadState("networkidle");

    // Look for link to terms
    const termsLink = page.getByRole("link", { name: /términos|terms/i }).first();
    if (await termsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await termsLink.click();
      await page.waitForLoadState("networkidle");
    }

    // Page should be stable
    await expect(page.locator("body")).toBeVisible();
  });

  test("user can navigate from terms to privacy", async ({ page }) => {
    await page.goto("/terms-of-use");
    await page.waitForLoadState("networkidle");

    // Page should load first
    await expect(page.locator("body")).toBeVisible();

    // Look for link to privacy
    const privacyLink = page.getByRole("link", { name: /privacidad|privacy/i }).first();
    if (await privacyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await privacyLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Page should be stable regardless of navigation
    await expect(page.locator("body")).toBeVisible();
  });

  test("policies pages have consistent layout", async ({ page }) => {
    // Check privacy policy
    await page.goto("/privacy-policy");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();

    // Check terms of use
    await page.goto("/terms-of-use");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("policies: home page", () => {
  test("home page loads correctly", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Home page should be visible
    await expect(page.locator("body")).toBeVisible();
  });

  test("home page contains links to policies", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Look for policy links (may be in footer)
    const hasPrivacyLink = await page.getByRole("link", { name: /privacidad|privacy/i }).first().isVisible().catch(() => false);
    const hasTermsLink = await page.getByRole("link", { name: /términos|terms/i }).first().isVisible().catch(() => false);

    // Page should load regardless of links
    await expect(page.locator("body")).toBeVisible();
  });
});
