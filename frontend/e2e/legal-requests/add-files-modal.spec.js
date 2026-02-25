import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installLegalRequestsApiMocks,
} from "../helpers/legalRequestsMocks.js";

const buildClientAuth = ({ userId }) => ({
  token: "e2e-token",
  userAuth: {
    id: userId,
    role: "client",
    is_gym_lawyer: false,
    is_profile_completed: true,
  },
});

async function openAddFilesModal(page, { userId }) {
  await installLegalRequestsApiMocks(page, {
    userId,
    role: "client",
  });

  // Mock file upload endpoint
  await page.route("**/api/legal_requests/*/files/", async (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Files uploaded successfully", files: [] }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await setAuthLocalStorage(page, buildClientAuth({ userId }));

  // Navigate to legal request detail
  await page.goto("/legal_request_detail/1001");
  await page.waitForLoadState("networkidle");

  // Wait for the detail page to load
  await expect(
    page.getByRole("heading", { name: "Detalle de Solicitud" })
  ).toBeVisible({ timeout: 10_000 });

  // Click "Agregar archivos" button
  await page.getByRole("button", { name: /Agregar archivos/i }).click();

  // Wait for AddFilesModal to open
  await expect(
    page.getByRole("heading", { name: "Agregar Archivos" })
  ).toBeVisible();
}

test.describe("AddFilesModal", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, () => {
  test("client opens add files modal and sees upload area", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const userId = 9000;

    await openAddFilesModal(page, { userId });

    // Upload area should be visible
    await expect(page.getByText("Arrastra archivos aquí")).toBeVisible();
    await expect(page.getByText("selecciona archivos", { exact: true })).toBeVisible();

    // Upload button should be disabled when no files selected
    const uploadButton = page.getByRole("button", { name: /Subir.*archivo/i });
    await expect(uploadButton).toBeDisabled();

    // Cancel button should be visible
    await expect(
      page.getByRole("button", { name: "Cancelar" })
    ).toBeVisible();
  });

  test("client selects a file and sees it listed", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const userId = 9001;

    await openAddFilesModal(page, { userId });

    // Select a PDF file
    // quality: allow-fragile-selector (hidden file input identified by id)
    const fileInput = page.locator("#file-upload");
    await fileInput.setInputFiles({
      name: "documento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%MOCK\n", "utf-8"),
    });

    // File should appear in the selected files list
    await expect(page.getByText("documento.pdf")).toBeVisible();
    await expect(page.getByText("Archivos seleccionados:")).toBeVisible();

    // Upload button should now be enabled
    const uploadButton = page.getByRole("button", { name: /Subir 1 archivo/i });
    await expect(uploadButton).toBeEnabled();
  });

  test("client removes a selected file", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const userId = 9002;

    await openAddFilesModal(page, { userId });

    // quality: allow-fragile-selector (hidden file input identified by id)
    const fileInput = page.locator("#file-upload");
    await fileInput.setInputFiles({
      name: "borrar.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%MOCK\n", "utf-8"),
    });

    await expect(page.getByText("borrar.pdf")).toBeVisible();

    // Click the remove button next to the file
    const fileRow = page.getByText("borrar.pdf").locator("xpath=ancestor::div[1]");
    await fileRow.getByRole("button").click();

    // File should be removed
    await expect(page.getByText("borrar.pdf")).toHaveCount(0);
  });

  test("client closes add files modal via cancel button", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const userId = 9003;

    await openAddFilesModal(page, { userId });

    await page.getByRole("button", { name: "Cancelar" }).click();

    // Modal should be dismissed
    await expect(
      page.getByRole("heading", { name: "Agregar Archivos" })
    ).toHaveCount(0);
  });

  test("upload button text shows correct file count", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const userId = 9004;

    await openAddFilesModal(page, { userId });

    // quality: allow-fragile-selector (hidden file input identified by id)
    const fileInput = page.locator("#file-upload");
    await fileInput.setInputFiles([
      {
        name: "file1.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n%MOCK1\n", "utf-8"),
      },
      {
        name: "file2.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
          "base64"
        ),
      },
    ]);

    // Button should show count of 2 files
    await expect(
      page.getByRole("button", { name: /Subir 2 archivos/i })
    ).toBeVisible();
  });
});
