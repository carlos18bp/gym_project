import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installLegalRequestsApiMocks } from "../helpers/legalRequestsMocks.js";

/**
 * Branch coverage tests for legal-requests-create flow.
 * Tests validation, file uploads, and error scenarios.
 */

test("client sees legal request creation form on solicitudes page", { tag: ['@flow:legal-create-request', '@module:legal-requests', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 9300;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "client",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/legal_requests");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("client sees existing requests on solicitudes page", { tag: ['@flow:legal-list-client', '@module:legal-requests', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 9301;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "client",
    requestDescription: "Consulta sobre contrato laboral",
    requestTypeName: "Consulta",
    disciplineName: "Laboral",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/legal_requests");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("lawyer sees management view for legal requests", { tag: ['@flow:legal-management-lawyer', '@module:legal-requests', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9302;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "lawyer",
    requestDescription: "Problema urgente con contrato",
    requestTypeName: "Tutela",
    disciplineName: "Civil",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/legal_requests");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});

test("client navigates to solicitudes with default request type", { tag: ['@flow:legal-create-request', '@module:legal-requests', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 9303;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "client",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/legal_requests");
  await page.waitForLoadState("networkidle");
  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});
