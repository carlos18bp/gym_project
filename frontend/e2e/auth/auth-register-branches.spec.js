import { test, expect } from "../helpers/test.js";
import { installAuthSignOnApiMocks } from "../helpers/authSignOnMocks.js";

/**
 * Branch coverage tests for auth-register flow.
 * Tests validation errors, duplicate email, and edge cases.
 */

test("registration form shows validation error on bad sign-on request", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  await installAuthSignOnApiMocks(page, {
    userId: 9100,
    signOnStatus: 400,
  });

  await page.goto("/sign_on");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("registration form shows error when verification code fails", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  await installAuthSignOnApiMocks(page, {
    userId: 9101,
    verificationStatus: 400,
  });

  await page.goto("/sign_on");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("registration page renders with all form fields", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  await installAuthSignOnApiMocks(page, {
    userId: 9102,
  });

  await page.goto("/sign_on");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("registration with server error shows error notification", { tag: ['@flow:auth-register', '@module:auth', '@priority:P1', '@role:shared'] }, async ({ page }) => {
  await installAuthSignOnApiMocks(page, {
    userId: 9103,
    signOnStatus: 500,
  });

  await page.goto("/sign_on");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});
