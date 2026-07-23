import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installLegalRequestsApiMocks } from "../helpers/legalRequestsMocks.js";

/**
 * Branch coverage tests for legal-requests-create flow.
 * Drives the solicitudes list for both roles and the creation form.
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
  await expect(page.getByRole("heading", { name: "Mis Solicitudes" })).toBeVisible({ timeout: 15_000 });

  // The "Nueva Solicitud" link navigates to the creation form
  const newRequestLink = page.getByRole("link", { name: "Nueva Solicitud" });
  await expect(newRequestLink).toBeVisible();
  await newRequestLink.click();

  await expect(page).toHaveURL(/\/legal_request_create/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Presentar Solicitud" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Tipo de solicitud")).toBeVisible();
  await expect(page.getByText("Especialidad")).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Mis Solicitudes" })).toBeVisible({ timeout: 15_000 });

  // The seeded request card renders its number, description and discipline
  await expect(page.getByText("REQ-1001")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Consulta sobre contrato laboral")).toBeVisible();
  await expect(page.getByText("Laboral", { exact: true })).toBeVisible();
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

  // Lawyers get the management heading and see every request in the system
  await expect(page.getByRole("heading", { name: "Solicitudes", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Gestiona todas las solicitudes legales")).toBeVisible();
  await expect(page.getByText("Problema urgente con contrato")).toBeVisible({ timeout: 10_000 });

  // The creation shortcut is client-only, so lawyers must not see it
  await expect(page.getByRole("link", { name: "Nueva Solicitud" })).toHaveCount(0);
});

test("client can pick a request type from the creation form options", { tag: ['@flow:legal-create-request', '@module:legal-requests', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 9303;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "client",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/legal_request_create");
  await expect(page.getByRole("heading", { name: "Presentar Solicitud" })).toBeVisible({ timeout: 15_000 });

  // Opening the "Tipo de solicitud" combobox lists the options from the API
  await page.getByRole("button", { name: "Seleccionar" }).first().click();
  await expect(page.getByRole("option", { name: "Consulta" })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("option", { name: "Tutela" })).toBeVisible();

  // Selecting an option fills the combobox input
  await page.getByRole("option", { name: "Tutela" }).click();
  await expect(page.getByRole("combobox").first()).toHaveValue("Tutela");
});
