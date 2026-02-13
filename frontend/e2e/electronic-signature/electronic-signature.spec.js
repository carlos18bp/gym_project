import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installElectronicSignatureApiMocks,
  PNG_1X1_BASE64,
} from "../helpers/electronicSignatureMocks.js";

test("upload electronic signature from Profile", async ({ page }) => {
  const userId = 123;

  await installElectronicSignatureApiMocks(page, { userId });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId },
  });

  await page.goto("/dashboard");

  // Open profile dropdown in sidebar
  await page
    .getByRole("button", { name: /Open user menu|Abrir menú de usuario/i })
    .click();

  await page.getByRole("menuitem", { name: "Perfil" }).click();

  // Open signature modal
  await page.getByRole("button", { name: "Firma electrónica" }).click();
  await expect(
    page.getByRole("heading", { name: "Firma Electrónica", exact: true })
  ).toBeVisible();

  // Choose upload mode
  await page.getByRole("button", { name: "Subir imagen" }).click();

  // Upload a small valid PNG
  await page
    .locator("input[type='file'][accept='image/png,image/jpeg']")
    .setInputFiles({
      name: "sig.png",
      mimeType: "image/png",
      buffer: Buffer.from(PNG_1X1_BASE64, "base64"),
    });

  // Wait for preview to appear (FileReader async) so the Save button becomes available.
  await expect(page.getByAltText("Firma")).toBeVisible();

  const uploadPanel = page
    .locator("input[type='file'][accept='image/png,image/jpeg']")
    .locator("xpath=ancestor::div[contains(@class,'p-4')][1]");

  await uploadPanel.getByRole("button", { name: /Guardar/i }).click();

  // Signature preview appears in ElectronicSignature component
  await expect(page.getByAltText("Firma guardada")).toBeVisible();

  // Signature modal should close automatically shortly after save
  await expect(
    page.getByRole("heading", { name: "Firma Electrónica", exact: true })
  ).toBeHidden({ timeout: 10_000 });

  // Green indicator dot should now be visible in Profile next to the button
  await expect(page.locator("button", { hasText: "Firma electrónica" }).locator(".bg-green-500")).toBeVisible();
});
