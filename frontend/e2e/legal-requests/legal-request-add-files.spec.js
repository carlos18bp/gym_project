import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installLegalRequestsApiMocks } from "../helpers/legalRequestsMocks.js";

/**
 * E2E for the "add files to an existing legal request" feature.
 *
 * add-files-modal.spec.js covers the modal internals (pick/remove/cancel);
 * this file covers the end of the flow — the upload actually reaching the
 * server and the detail page reflecting it — plus the two guards that hide
 * the entry point (`canAddFiles`).
 */

const CLIENT_AUTH = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
});

test.describe("Add files to a legal request", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, () => {
  test("client uploads a file and the request lists it", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const userId = 2300;

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "client",
      requestDescription: "Necesito asesoría legal",
    });

    await setAuthLocalStorage(page, CLIENT_AUTH(userId));

    await page.goto("/legal_request_detail/1001");

    await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("No hay archivos adjuntos")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /Agregar archivos/i }).click();
    await expect(page.getByRole("heading", { name: "Agregar Archivos" })).toBeVisible({ timeout: 10_000 });

    // quality: allow-fragile-selector (hidden file input identified by id)
    await page.locator("#file-upload").setInputFiles({
      name: "poder.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%MOCK\n", "utf-8"),
    });

    const uploadRequest = page.waitForRequest(
      (request) =>
        request.url().includes("/api/legal_requests/1001/files/") &&
        request.method() === "POST"
    );
    await page.getByRole("button", { name: /Subir 1 archivo/i }).click();
    const sent = await uploadRequest;
    expect(sent.postData()).toContain('filename="poder.pdf"');

    // The modal closes and the refreshed detail lists the uploaded file
    await expect(page.getByRole("heading", { name: "Agregar Archivos" })).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText("poder.pdf")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("No hay archivos adjuntos")).toHaveCount(0);
  });

  test("client cannot add files to a closed request", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, async ({ page }) => {
    // audit: load-only flow (role/state restriction — the CLOSED status must
    // hide the entry point, so there is no action left for the user to drive)
    const userId = 2301;

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "client",
      requestStatus: "CLOSED",
      requestDescription: "Solicitud ya cerrada",
    });

    await setAuthLocalStorage(page, CLIENT_AUTH(userId));

    await page.goto("/legal_request_detail/1001");

    await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Archivos Adjuntos" })).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole("button", { name: /Agregar archivos/i })).toHaveCount(0);
  });

  test("lawyer cannot add files to a client request", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
    // audit: load-only flow (role restriction — the add-files entry point is
    // client-only, so a lawyer has nothing to click here)
    const userId = 2310;

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "lawyer",
      ownerId: 999,
      requestDescription: "Consulta sobre proceso penal",
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/legal_request_detail/1001");

    await expect(page.getByRole("heading", { name: "REQ-1001" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Archivos Adjuntos" })).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole("button", { name: /Agregar archivos/i })).toHaveCount(0);
  });
});
