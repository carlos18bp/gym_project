import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer opens Firma Electrónica modal and sees signature options (upload/draw)", async ({ page }) => {
  const userId = 9600;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, has_signature: false },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Click "Firma Electrónica" button
  await page.getByRole("button", { name: "Firma Electrónica" }).first().click();

  // ElectronicSignature component should render with signature options
  await expect(page.getByText("Añadir firma electrónica")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Selecciona el método para añadir tu firma electrónica")).toBeVisible();

  // Two signature method buttons should be visible
  await expect(page.getByRole("button", { name: "Subir imagen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dibujar firma" })).toBeVisible();
});

test("lawyer clicks 'Dibujar firma' and sees DrawSignature canvas component", async ({ page }) => {
  const userId = 9601;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true, has_signature: false },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Open electronic signature modal
  await page.getByRole("button", { name: "Firma Electrónica" }).first().click();
  await expect(page.getByText("Añadir firma electrónica")).toBeVisible({ timeout: 10_000 });

  // Click "Dibujar firma"
  await page.getByRole("button", { name: "Dibujar firma" }).click();

  // DrawSignature component should render with canvas and action buttons
  await expect(page.locator("canvas")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Guardar/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Volver/i })).toBeVisible();
});

test("client opens Firma Electrónica from dashboard", async ({ page }) => {
  const userId = 9602;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true, has_signature: false },
  });

  await page.goto("/dynamic_document_dashboard");

  // Client should see Firma Electrónica button
  await page.getByRole("button", { name: "Firma Electrónica" }).first().click();

  // Should see signature options
  await expect(page.getByText("Añadir firma electrónica")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Subir imagen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dibujar firma" })).toBeVisible();
});
