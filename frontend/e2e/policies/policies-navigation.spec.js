import { test, expect } from "../helpers/test.js";

/**
 * E2E tests for policies pages (PrivacyPolicy.vue, TermsOfUse.vue)
 *
 * NOTE: earlier versions navigated to "/privacy-policy" and "/terms-of-use",
 * routes that do not exist — the catch-all redirected every test to /sign_in
 * and the body-visible asserts could never fail. The real public routes are
 * /policies/privacy_policy and /policies/terms_of_use, and the sign-in page
 * links to both ("Aviso de privacidad" / "Condiciones de uso"). Neither
 * policy page links to the other one directly.
 */

test.describe("policies: privacy policy page", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, () => {
  test("privacy policy page loads successfully", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await page.goto("/policies/privacy_policy");

    await expect(page.getByRole("heading", { name: "Política de Privacidad", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "1. Introducción" })).toBeVisible();
  });

  test("privacy policy contains required sections", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await page.goto("/policies/privacy_policy");

    await expect(page.getByRole("heading", { name: "1. Introducción" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2. Información que Recopilamos" })).toBeVisible();
    await expect(page.getByText("Ley Estatutaria 1581 de 2012")).toBeVisible();
  });

  test("privacy policy is accessible without authentication", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    // No auth setup — the route is public and must NOT redirect to sign in
    await page.goto("/policies/privacy_policy");

    await expect(page).toHaveURL(/\/policies\/privacy_policy/);
    await expect(page.getByRole("heading", { name: "Política de Privacidad", exact: true })).toBeVisible();
  });

  test("privacy policy page is scrollable for long content", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await page.goto("/policies/privacy_policy");
    await expect(page.getByRole("heading", { name: "Política de Privacidad", exact: true })).toBeVisible();

    // Scroll down and verify the page actually moved
    await page.evaluate(() => window.scrollBy(0, 500));
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });
});

test.describe("policies: terms of use page", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, () => {
  test("terms of use page loads successfully", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await page.goto("/policies/terms_of_use");

    await expect(page.getByRole("heading", { name: "Términos y Condiciones", exact: true })).toBeVisible();
  });

  test("terms of use contains required sections", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await page.goto("/policies/terms_of_use");

    await expect(page.getByRole("heading", { name: "1. Introducción" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2. Descripción del Servicio" })).toBeVisible();
  });

  test("terms of use is accessible without authentication", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    // No auth setup — the route is public and must NOT redirect to sign in
    await page.goto("/policies/terms_of_use");

    await expect(page).toHaveURL(/\/policies\/terms_of_use/);
    await expect(page.getByRole("heading", { name: "Términos y Condiciones", exact: true })).toBeVisible();
  });
});

test.describe("policies: navigation between pages", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, () => {
  test("user reaches terms of use from the sign in page link", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await page.goto("/sign_in");

    await page.getByRole("link", { name: "Condiciones de uso" }).click();

    await expect(page).toHaveURL(/\/policies\/terms_of_use/);
    await expect(page.getByRole("heading", { name: "Términos y Condiciones", exact: true })).toBeVisible();
  });

  test("user reaches privacy policy from the sign in page link", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await page.goto("/sign_in");

    await page.getByRole("link", { name: "Aviso de privacidad" }).click();

    await expect(page).toHaveURL(/\/policies\/privacy_policy/);
    await expect(page.getByRole("heading", { name: "Política de Privacidad", exact: true })).toBeVisible();
  });

  test("policy pages navigate back to sign in via the close button", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await page.goto("/policies/privacy_policy");
    await expect(page.getByRole("heading", { name: "Política de Privacidad", exact: true })).toBeVisible();

    // The header close (X) link returns to the sign-in page
    // quality: allow-fragile-selector (positional access: header X link, second link in header)
    await page.locator("a[href='/sign_in']").last().click();
    await expect(page).toHaveURL(/\/sign_in/);
  });
});

test.describe("policies: home page", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, () => {
  test("root path redirects unauthenticated visitors to sign in", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/sign_in/);
  });

  test("sign in page contains links to both policies", { tag: ['@flow:misc-policies', '@module:misc', '@priority:P4', '@role:shared'] }, async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign_in/);

    await expect(page.getByRole("link", { name: "Aviso de privacidad" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Condiciones de uso" })).toBeVisible();
  });
});
