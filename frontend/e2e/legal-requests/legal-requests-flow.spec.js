import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import { installLegalRequestsApiMocks } from "../helpers/legalRequestsMocks.js";

test("client can create a legal request and is redirected to list", async ({ page }) => {
  const userId = 900;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "client",
    requestTypeName: "Consulta",
    disciplineName: "Civil",
    requestDescription: "Necesito ayuda con un contrato.",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/legal_request_create");

  await expect(page.getByRole("heading", { name: "Presentar Solicitud" })).toBeVisible();

  // Select request type
  await page.getByRole("button", { name: "Seleccionar" }).first().click();
  await page.getByRole("option", { name: "Consulta" }).click();

  // Select discipline
  await page.getByRole("button", { name: "Seleccionar" }).nth(1).click();
  await page.getByRole("option", { name: "Civil" }).click();

  // Description
  await page.locator("#comment").fill("Necesito ayuda con un contrato.");

  // Submit
  await page.getByRole("button", { name: "Guardar" }).click();

  // Success notification modal can aria-hide the page; close it before asserting the list UI.
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "OK" }).click();

  await expect(page).toHaveURL(/\/legal_requests/);
  await expect(page.getByRole("heading", { name: "Mis Solicitudes" })).toBeVisible();
});

test("lawyer can view legal requests list and open a request detail", async ({ page }) => {
  const userId = 901;

  await installLegalRequestsApiMocks(page, {
    userId,
    role: "lawyer",
    requestTypeName: "Consulta",
    disciplineName: "Civil",
    requestDescription: "Descripción de prueba",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/legal_requests");

  await expect(page.getByRole("heading", { name: "Solicitudes" })).toBeVisible();
  await expect(page.getByText("REQ-1001")).toBeVisible();

  const reqCard = page.locator("div.bg-white.rounded-lg.shadow").filter({ hasText: "REQ-1001" });
  await reqCard.getByRole("button", { name: /Ver detalles/i }).click();

  await expect(page).toHaveURL(/\/legal_request_detail\/1001/);
  await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible();
  await expect(page.getByText("Descripción de prueba")).toBeVisible();
});
