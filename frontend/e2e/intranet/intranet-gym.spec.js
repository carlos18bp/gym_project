import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockIntranetDoc,
  installIntranetGymApiMocks,
  installUnsplashImageStub,
} from "../helpers/intranetGymMocks.js";

test("intranet G&M loads docs, filters search, opens modals, and submits report", async ({ page }) => {
  const userId = 2000;

  await installUnsplashImageStub(page);

  await installIntranetGymApiMocks(page, {
    userId,
    role: "lawyer",
    documents: [
      buildMockIntranetDoc({ id: 1, name: "Procedimiento Comercial" }),
      buildMockIntranetDoc({ id: 2, name: "Procedimiento Operativo" }),
    ],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "lawyer",
      is_gym_lawyer: true,
      is_profile_completed: true,
      first_name: "E2E",
      last_name: "Lawyer",
      email: "lawyer@example.com",
    },
  });

  await page.goto("/intranet_g_y_m");
  await expect(page).toHaveURL(/\/intranet_g_y_m/);

  // Page header content
  await expect(page.getByText("Procedimientos G&M")).toBeVisible();

  // Documents list renders
  await expect(page.getByRole("button", { name: "Procedimiento Comercial" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Procedimiento Operativo" })).toBeVisible();

  // Search filters
  await page.locator("input#search").fill("comercial");
  await expect(page.getByRole("button", { name: "Procedimiento Comercial" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Procedimiento Operativo" })).toHaveCount(0);

  // Open and close organization chart
  await page.getByRole("button", { name: "Ver Organigrama" }).click();
  await expect(page.getByRole("heading", { name: "Organigrama G&M" })).toBeVisible();
  // The modal has 2 close buttons: an icon button (title="Cerrar") and a footer button (text "Cerrar").
  // Click the footer one to avoid strict-mode violations.
  await page.locator('button:has-text("Cerrar")').click();
  await expect(page.getByRole("heading", { name: "Organigrama G&M" })).toHaveCount(0);

  // Open report modal
  await page.getByRole("button", { name: "Enviar Informe" }).click();
  await expect(page.getByRole("heading", { name: "Presentar Informe" })).toBeVisible();

  await page.locator("#document-number").fill("CT-001");
  await page.locator("#initial-report-period").fill("2026-01-01");
  await page.locator("#final-report-period").fill("2026-01-31");

  // FacturationForm has duplicate id="payment-concept" (concept + amount). Use nth.
  await page.locator("input#payment-concept").nth(0).fill("Honorarios");
  await page.locator("input#payment-concept").nth(1).fill("500000");

  await page.locator("input#file-upload").setInputFiles({
    name: "invoice.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n", "utf-8"),
  });

  await page.getByRole("button", { name: "Guardar" }).click();

  // Success notification
  // showLoading() opens a Swal without a confirm button; showNotification() opens the success Swal with confirm.
  await expect(page.locator(".swal2-confirm")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-title")).toHaveText("¡Solicitud creada exitosamente!");
  await page.locator(".swal2-confirm").click();

  await expect(page).toHaveURL(/\/dashboard/);
});
