// quality: disable fragile_test_data (emails are mock credentials used only for API route interception, not real production data)
import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installServiceTramiteApiMocks,
  buildMockServiceField,
  buildMockServiceStage,
  buildMockService,
} from "../helpers/serviceTramiteMocks.js";

const CLIENT_ID = 8001;

function buildFileUploadService() {
  return buildMockService({
    id: 200,
    name: "Tramite con Archivos",
    short_title: "Archivos",
    slug: "tramite-archivos",
    stages: [
      buildMockServiceStage({
        id: 10,
        title: "Documentos Requeridos",
        order: 1,
        fields: [
          buildMockServiceField({
            id: 201,
            key: "documentos",
            label: "Documentos adjuntos",
            field_type: "file",
            allow_multiple_files: true,
            max_files: 3,
            allowed_extensions: ["pdf", "jpg", "png"],
            is_required: true,
            order: 1,
          }),
        ],
      }),
    ],
  });
}

test(
  "client can upload a file and see it listed with remove button",
  {
    tag: [
      "@flow:service-upload-multiple-files",
      "@module:services",
      "@priority:P2",
      "@role:client",
    ],
  },
  async ({ page }) => {
    const service = buildFileUploadService();

    await installServiceTramiteApiMocks(page, {
      userId: CLIENT_ID,
      role: "client",
      services: [service],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: CLIENT_ID,
        role: "client",
        first_name: "Client",
        last_name: "E2E",
        email: "client@example.com",
        is_profile_completed: true,
      },
    });

    await page.goto(`/services/${service.id}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Documentos adjuntos")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Puedes seleccionar hasta 3 archivos/)).toBeVisible();

    // Upload first file via the data-field-id input
    const fileInput = page.locator(`input[type="file"][data-field-id="201"]`);
    await fileInput.setInputFiles({
      name: "contrato.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("PDF content"),
    });

    // File card appears with file name
    await expect(page.getByText("contrato.pdf")).toBeVisible({ timeout: 5_000 });

    // Counter shows 1/3
    await expect(page.getByText(/Archivos seleccionados \(1\/3\)/)).toBeVisible();

    // The "Eliminar archivo" button is present
    await expect(page.getByTitle("Eliminar archivo")).toBeVisible();
  }
);

test(
  "client can remove a previously selected file",
  {
    tag: [
      "@flow:service-upload-multiple-files",
      "@module:services",
      "@priority:P2",
      "@role:client",
    ],
  },
  async ({ page }) => {
    const service = buildFileUploadService();

    await installServiceTramiteApiMocks(page, {
      userId: CLIENT_ID,
      role: "client",
      services: [service],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: CLIENT_ID,
        role: "client",
        first_name: "Client",
        last_name: "E2E",
        email: "client@example.com",
        is_profile_completed: true,
      },
    });

    await page.goto(`/services/${service.id}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Documentos adjuntos")).toBeVisible({ timeout: 15_000 });

    const fileInput = page.locator(`input[type="file"][data-field-id="201"]`);
    await fileInput.setInputFiles({
      name: "documento.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("JPEG content"),
    });

    await expect(page.getByText("documento.jpg")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Archivos seleccionados \(1\/3\)/)).toBeVisible();

    // Remove the file
    await page.getByTitle("Eliminar archivo").click();

    // File card is gone; counter section disappears when no files remain
    await expect(page.getByText("documento.jpg")).not.toBeVisible();
    await expect(page.getByText(/Archivos seleccionados/)).not.toBeVisible();
  }
);

test(
  "file input is disabled when max files limit is reached",
  {
    tag: [
      "@flow:service-upload-multiple-files",
      "@module:services",
      "@priority:P2",
      "@role:client",
    ],
  },
  async ({ page }) => {
    const service = buildFileUploadService();

    await installServiceTramiteApiMocks(page, {
      userId: CLIENT_ID,
      role: "client",
      services: [service],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: CLIENT_ID,
        role: "client",
        first_name: "Client",
        last_name: "E2E",
        email: "client@example.com",
        is_profile_completed: true,
      },
    });

    await page.goto(`/services/${service.id}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Documentos adjuntos")).toBeVisible({ timeout: 15_000 });

    const fileInput = page.locator(`input[type="file"][data-field-id="201"]`);

    // Upload files one at a time up to the limit (max_files = 3)
    for (const [idx, name] of ["archivo1.pdf", "archivo2.pdf", "archivo3.pdf"].entries()) {
      await fileInput.setInputFiles({
        name,
        mimeType: "application/pdf",
        buffer: Buffer.from(`PDF ${idx}`),
      });
    }

    // Counter shows 3/3
    await expect(page.getByText(/Archivos seleccionados \(3\/3\)/)).toBeVisible({ timeout: 5_000 });

    // Limit warning is shown
    await expect(page.getByText(/Has alcanzado el límite de 3 archivos/)).toBeVisible();

    // File input is disabled
    await expect(fileInput).toBeDisabled();
  }
);
