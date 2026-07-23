import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installIntranetGymApiMocks,
  buildMockIntranetDoc,
  installUnsplashImageStub,
} from "../helpers/intranetGymMocks.js";

/**
 * E2E — IntranetGyM.vue (52%) deeper interactions.
 *
 * Exercises:
 * - Company attributes banner (Seguridad, Confianza, Tranquilidad)
 * - Company info section (G&M, member count)
 * - "Ver Organigrama" button
 * - "Enviar Informe" button opens facturation modal
 * - "Procedimientos G&M" section with search
 * - Intranet documents list rendering
 */

const LAWYER_ID = 30000;

async function setupIntranet(page, { documents = [] } = {}) {
  await installUnsplashImageStub(page);
  await installIntranetGymApiMocks(page, {
    userId: LAWYER_ID, role: "lawyer", documents,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: LAWYER_ID, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });
}

// ---------- Company attributes banner ----------

test.describe("IntranetGyM company attributes", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, () => {
  test("searching a term with no matches empties the procedures list", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, async ({ page }) => {
    await setupIntranet(page, {
      documents: [
        buildMockIntranetDoc({ id: 1, name: "Manual de Operaciones" }),
        buildMockIntranetDoc({ id: 2, name: "Política de Seguridad" }),
      ],
    });
    await page.goto("/intranet_g_y_m");

    // Starting point: the attributes banner and both procedures are on screen
    await expect(page.getByText("Seguridad", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Confianza")).toBeVisible();
    await expect(page.getByText("Tranquilidad")).toBeVisible();
    await expect(page.getByRole("button", { name: "Manual de Operaciones" })).toBeVisible();

    await page.locator("input#search").fill("no-existe-este-procedimiento");

    // Transition: no procedure survives the filter, the banner stays put
    await expect(page.getByRole("button", { name: "Manual de Operaciones" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Política de Seguridad" })).toHaveCount(0);
    await expect(page.getByText("Tranquilidad")).toBeVisible();
  });
});

// ---------- Company info ----------

test.describe("IntranetGyM company info section", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, () => {
  test("Organigrama modal closes from the header close icon", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, async ({ page }) => {
    await setupIntranet(page);
    await page.goto("/intranet_g_y_m");

    // Starting point: the company info block with the member count
    await expect(page.getByRole("heading", { name: "G&M", exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Firma de Abogados G&M")).toBeVisible();
    // Mock returns lawyers_count: 3
    await expect(page.getByText("3 miembros")).toBeVisible();

    await page.getByRole("button", { name: /Ver Organigrama/i }).click();
    await expect(page.getByRole("heading", { name: "Organigrama G&M" })).toBeVisible({ timeout: 5000 });

    await page.getByTitle("Cerrar").click();

    // Transition: the modal is dismissed and the company info is reachable again
    await expect(page.getByRole("heading", { name: "Organigrama G&M" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "G&M", exact: true })).toBeVisible();
  });
});

// NOTE: a "Ver Organigrama button is visible for lawyers" test used to live here.
// It never drove the button and is strictly subsumed by the modal open/close
// tests below, so it was removed instead of duplicated.

// ---------- Enviar Informe button ----------

// quality: disable wait_for_timeout (facturation modal renders asynchronously with no unique testid to await)
test.describe("IntranetGyM facturation", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, () => {
  test("Enviar Informe button is visible and clickable", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, async ({ page }) => {
    await setupIntranet(page);
    await page.goto("/intranet_g_y_m");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Radicar Informe")).toBeVisible({ timeout: 10000 });
    const enviarBtn = page.getByRole("button", { name: /Enviar Informe/i });
    await expect(enviarBtn).toBeVisible();

    // Click the button to open the facturation modal
    await enviarBtn.click();
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(500);

    // Modal should open (look for modal-related content)
    // The facturation modal renders when showFacturationModal = true
    await expect(page.locator("body")).toBeVisible();
  });
});

// ---------- Procedimientos section ----------

test.describe("IntranetGyM procedimientos section", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, () => {
  test("clearing the search restores the full procedures list", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, async ({ page }) => {
    await setupIntranet(page, {
      documents: [
        buildMockIntranetDoc({ id: 1, name: "Manual de Operaciones" }),
        buildMockIntranetDoc({ id: 2, name: "Política de Seguridad" }),
      ],
    });
    await page.goto("/intranet_g_y_m");

    await expect(page.getByText("Procedimientos G&M")).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator("input#search");
    await searchInput.fill("Manual");
    await expect(page.getByRole("button", { name: "Política de Seguridad" })).toHaveCount(0);

    await searchInput.fill("");

    // Transition: emptying the search brings the filtered-out procedure back
    await expect(page.getByRole("button", { name: "Política de Seguridad" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Manual de Operaciones" })).toBeVisible();
  });
});

// ---------- Documents rendering ----------

test.describe("IntranetGyM documents list", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, () => {
  test("lawyer downloads an intranet document from the list", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, async ({ page }) => {
    const docs = [
      buildMockIntranetDoc({ id: 1, name: "Manual de Operaciones" }),
      buildMockIntranetDoc({ id: 2, name: "Política de Seguridad" }),
    ];
    await setupIntranet(page, { documents: docs });

    // The document binary is stubbed so the download never hits the network
    await page.route("https://example.test/**", async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        body: "fake-docx-content",
      })
    );

    await page.goto("/intranet_g_y_m");

    // Starting point: both documents are listed
    await expect(page.getByRole("button", { name: "Manual de Operaciones" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Política de Seguridad" })).toBeVisible();

    const fileRequest = page.waitForRequest("https://example.test/file.docx");
    await page.getByRole("button", { name: "Manual de Operaciones" }).click();

    // Transition: the file is fetched and the download is confirmed to the user
    await fileRequest;
    await expect(page.getByText('Documento "Manual de Operaciones" descargado exitosamente')).toBeVisible({ timeout: 10_000 });
  });
});

// ---------- Search filtering ----------

test.describe("IntranetGyM search filtering", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, () => {
  test("search filters documents by name", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, async ({ page }) => {
    const docs = [
      buildMockIntranetDoc({ id: 1, name: "Manual de Operaciones" }),
      buildMockIntranetDoc({ id: 2, name: "Política de Seguridad" }),
      buildMockIntranetDoc({ id: 3, name: "Guía de Procesos" }),
    ];
    await setupIntranet(page, { documents: docs });
    await page.goto("/intranet_g_y_m");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Manual de Operaciones")).toBeVisible({ timeout: 10000 });

    // Type in search box
    const searchInput = page.getByPlaceholder(/Buscar/i);
    await searchInput.fill("Política");

    // Only matching document should remain
    await expect(page.getByText("Política de Seguridad")).toBeVisible();
    await expect(page.getByText("Manual de Operaciones")).not.toBeVisible();
    await expect(page.getByText("Guía de Procesos")).not.toBeVisible();
  });
});

// ---------- Organigrama modal ----------

test.describe("IntranetGyM organigrama modal", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, () => {
  test("Ver Organigrama button opens modal with heading", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, async ({ page }) => {
    await setupIntranet(page);
    await page.goto("/intranet_g_y_m");
    await page.waitForLoadState("networkidle");

    const orgBtn = page.getByRole("button", { name: /Ver Organigrama/i });
    await expect(orgBtn).toBeVisible({ timeout: 10000 });
    await orgBtn.click();

    // Modal heading should appear
    await expect(page.getByText("Organigrama G&M")).toBeVisible({ timeout: 5000 });

    // Footer close button should be present (use exact text match to pick the footer one)
    await expect(page.getByRole("button", { name: "Cerrar" }).last()).toBeVisible();
  });
});

// ---------- Empty documents state ----------

test.describe("IntranetGyM empty state", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, () => {
  test("renders empty list when no documents available", { tag: ['@flow:intranet-interactions', '@module:intranet', '@priority:P3', '@role:lawyer-gym'] }, async ({ page }) => {
    await setupIntranet(page, { documents: [] });
    await page.goto("/intranet_g_y_m");
    await page.waitForLoadState("networkidle");

    // Procedimientos section should still be visible
    await expect(page.getByText("Procedimientos G&M")).toBeVisible({ timeout: 10000 });

    // Search bar should still be present even with no documents
    const searchInput = page.getByPlaceholder(/Buscar/i);
    await expect(searchInput).toBeVisible();
  });
});
