import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
} from "../helpers/dynamicDocumentMocks.js";

const buildLawyerAuth = ({ userId }) => ({
  token: "e2e-token",
  userAuth: {
    id: userId,
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
  },
});

/**
 * Navigate to the dynamic document dashboard and open the
 * ElectronicSignatureModal via the "Firma" action button.
 */
async function openSignatureModal(page, { userId, hasSignature = false }) {
  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature,
    documents: [],
  });

  // Mock the signature update endpoint
  await page.route("**/api/users/update_signature/*/", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Signature updated successfully" }),
    });
  });

  await setAuthLocalStorage(page, buildLawyerAuth({ userId }));
  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // Click the "Firma Electrónica" button to open ElectronicSignatureModal
  await page.getByRole("button", { name: "Firma Electrónica" }).click();

  // Verify the modal opened — the h2 heading is exactly "Firma Electrónica"
  await expect(
    page.getByRole("heading", { name: "Firma Electrónica", exact: true })
  ).toBeVisible();
}

test.describe("ElectronicSignatureModal", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, () => {
  test("lawyer opens signature modal and sees signature options", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 2000;

    await openSignatureModal(page, { userId, hasSignature: false });

    // Should show the two signature creation options
    await expect(page.getByRole("button", { name: "Subir imagen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dibujar firma" })).toBeVisible();
  });

  test("lawyer selects draw signature and sees canvas", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 2001;

    await openSignatureModal(page, { userId, hasSignature: false });

    await page.getByRole("button", { name: "Dibujar firma" }).click();

    // DrawSignature component should render with canvas and controls
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByText("Dibuja tu firma aquí")).toBeVisible();

    // Save button should be disabled until user draws
    const saveButton = page.getByRole("button", { name: "Guardar" });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeDisabled();
  });

  test("lawyer draws on canvas and saves signature", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 2002;

    await openSignatureModal(page, { userId, hasSignature: false });

    await page.getByRole("button", { name: "Dibujar firma" }).click();

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Simulate drawing on the canvas
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 100);
    await page.mouse.move(box.x + 200, box.y + 50);
    await page.mouse.up();

    // After drawing, the save button should be enabled
    const saveButton = page.getByRole("button", { name: "Guardar" });
    await expect(saveButton).toBeEnabled();

    // Click save — should trigger the API call and show success notification
    await saveButton.click();

    // The success notification from ElectronicSignatureModal.handleSignatureSaved
    await expect(
      page.getByText("Firma electrónica guardada correctamente")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("lawyer selects upload signature and sees file input area", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 2003;

    await openSignatureModal(page, { userId, hasSignature: false });

    await page.getByRole("button", { name: "Subir imagen" }).click();

    // ImageUploadSignature should show the upload area
    await expect(
      page.getByText("Haz clic para subir una imagen")
    ).toBeVisible();

    // Back button should be available
    await expect(page.getByRole("button", { name: "Volver" })).toBeVisible();
  });

  test("lawyer uploads image file and saves signature", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 2004;

    await openSignatureModal(page, { userId, hasSignature: false });

    await page.getByRole("button", { name: "Subir imagen" }).click();

    // Set a small PNG file via the hidden file input
    // quality: allow-fragile-selector (hidden file input scoped by accept attribute)
    const fileInput = page.locator('input[type="file"][accept="image/png,image/jpeg"]');
    await fileInput.setInputFiles({
      name: "signature.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64"
      ),
    });

    // After upload, a preview image and save button should appear
    await expect(page.locator('img[alt="Firma"]')).toBeVisible();
    const saveButton = page.getByRole("button", { name: "Guardar" });
    await expect(saveButton).toBeVisible();

    await saveButton.click();

    await expect(
      page.getByText("Firma electrónica guardada correctamente")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("lawyer can close signature modal via close button", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 2005;

    await openSignatureModal(page, { userId, hasSignature: false });

    // The close (X) button is in the modal header
    const closeButton = page
      .getByRole("heading", { name: "Firma Electrónica", exact: true })
      .locator("xpath=ancestor::div[1]")
      .getByRole("button");
    await closeButton.click();

    // Modal should be dismissed
    await expect(
      page.getByRole("heading", { name: "Firma Electrónica", exact: true })
    ).toHaveCount(0);
  });

  test("lawyer cancels draw signature via back button", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 2006;

    await openSignatureModal(page, { userId, hasSignature: false });

    await page.getByRole("button", { name: "Dibujar firma" }).click();
    await expect(page.locator("canvas")).toBeVisible();

    // Click "Volver" to go back to options
    await page.getByRole("button", { name: "Volver" }).click();

    // Modal should close (cancel emits close on ElectronicSignatureModal)
    await expect(
      page.getByRole("heading", { name: "Firma Electrónica", exact: true })
    ).toHaveCount(0);
  });

  test("SignatureModal shows heading and description text", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 2007;

    await openSignatureModal(page, { userId, hasSignature: false });

    // SignatureModal renders inside ElectronicSignature when initialShowOptions is true
    // Verify the inner heading and description are visible
    await expect(
      page.getByText("Añadir firma electrónica")
    ).toBeVisible();
    await expect(
      page.getByText("Selecciona el método para añadir tu firma electrónica")
    ).toBeVisible();
  });

  test("clear button resets the drawn signature on canvas", { tag: ['@flow:sign-electronic-signature', '@module:signatures', '@priority:P1', '@role:lawyer'] }, async ({ page }) => {
    const userId = 2008;

    await openSignatureModal(page, { userId, hasSignature: false });

    await page.getByRole("button", { name: "Dibujar firma" }).click();

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Draw on canvas
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 80);
    await page.mouse.up();

    // Save button should be enabled after drawing
    await expect(page.getByRole("button", { name: "Guardar" })).toBeEnabled();

    // Click "Limpiar" to clear the canvas
    const clearBtn = page.getByRole("button", { name: /Limpiar/i });
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      // After clearing, save button should be disabled again
      await expect(page.getByRole("button", { name: "Guardar" })).toBeDisabled({ timeout: 5_000 });
    }
  });
});
