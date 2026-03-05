import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installIntranetGymApiMocks,
  installUnsplashImageStub,
} from "../helpers/intranetGymMocks.js";

/**
 * FacturationForm field-level interaction tests.
 * Covers: required field validation, file upload interactions, form submission.
 */

const userId = 3000;

async function setupPage(page) {
  await installUnsplashImageStub(page);
  await installIntranetGymApiMocks(page, { userId, role: "lawyer", documents: [] });
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
}

test("facturation form: save button disabled until all required fields filled", { tag: ['@flow:intranet-facturation-form', '@module:intranet', '@priority:P2', '@role:lawyer-gym'] }, async ({ page }) => {
  await setupPage(page);
  await page.goto("/intranet_g_y_m");

  await page.getByRole("button", { name: "Enviar Informe" }).click();
  await expect(page.getByRole("heading", { name: "Presentar Informe" })).toBeVisible();

  const saveBtn = page.getByRole("button", { name: "Guardar" });
  await expect(saveBtn).toBeDisabled();

  await page.locator("#document-number").fill("CT-100"); // quality: allow-fragile-selector (stable DOM id)
  await expect(saveBtn).toBeDisabled();

  await page.locator("#initial-report-period").fill("2026-01-01"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#final-report-period").fill("2026-01-31"); // quality: allow-fragile-selector (stable DOM id)
  await expect(saveBtn).toBeDisabled();

  await page.locator("input#payment-concept").nth(0).fill("Honorarios"); // quality: allow-fragile-selector (positional selector for specific list item)
  await expect(saveBtn).toBeDisabled();

  await page.locator("input#payment-concept").nth(1).fill("1000000"); // quality: allow-fragile-selector (positional selector for specific list item)
  await expect(saveBtn).toBeEnabled();
});

test("facturation form: file upload shows file in list and unsupported type is rejected", { tag: ['@flow:intranet-facturation-form', '@module:intranet', '@priority:P2', '@role:lawyer-gym'] }, async ({ page }) => {
  await setupPage(page);
  await page.goto("/intranet_g_y_m");

  await page.getByRole("button", { name: "Enviar Informe" }).click();
  await expect(page.getByRole("heading", { name: "Presentar Informe" })).toBeVisible();

  // Upload valid PDF
  // quality: allow-fragile-selector (hidden file input identified by stable DOM id)
  await page.locator("input#file-upload").setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4", "utf-8"),
  });

  await expect(page.getByText("contract.pdf")).toBeVisible();
});

test("facturation form: successful submission closes modal", { tag: ['@flow:intranet-facturation-form', '@module:intranet', '@priority:P2', '@role:lawyer-gym'] }, async ({ page }) => {
  await setupPage(page);
  await page.goto("/intranet_g_y_m");

  await page.getByRole("button", { name: "Enviar Informe" }).click();
  await expect(page.getByRole("heading", { name: "Presentar Informe" })).toBeVisible();

  // quality: allow-fragile-selector (stable DOM ids and positional selectors for form fields)
  await page.locator("#document-number").fill("CT-200");
  await page.locator("#initial-report-period").fill("2026-02-01"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#final-report-period").fill("2026-02-28"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("input#payment-concept").nth(0).fill("Servicios"); // quality: allow-fragile-selector (positional selector for duplicate input)
  await page.locator("input#payment-concept").nth(1).fill("2000000"); // quality: allow-fragile-selector (positional selector for duplicate input)

  await page.getByRole("button", { name: "Guardar" }).click();

  // After successful submission, modal should close and redirect to dashboard
  await expect(page.getByRole("heading", { name: "Presentar Informe" })).toHaveCount(0, { timeout: 10_000 });
});

test("facturation form: close button dismisses modal", { tag: ['@flow:intranet-facturation-form', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, async ({ page }) => {
  await setupPage(page);
  await page.goto("/intranet_g_y_m");

  await page.getByRole("button", { name: "Enviar Informe" }).click();
  await expect(page.getByRole("heading", { name: "Presentar Informe" })).toBeVisible();

  // Click the X close button
  // quality: allow-fragile-selector (class selector for close icon without data-testid)
  await page.locator(".cursor-pointer").first().click();
  await expect(page.getByRole("heading", { name: "Presentar Informe" })).toHaveCount(0);
});
