import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
// @flow: tags must be inline strings — imported constants are invisible to the coverage scanner

function buildLawyerUser(id) {
  return {
    id,
    first_name: "E2E",
    last_name: "Lawyer",
    email: "e2e@example.com",
    role: "lawyer",
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    created_at: new Date().toISOString(),
    is_profile_completed: true,
    is_gym_lawyer: true,
    has_signature: false,
  };
}

async function installDashboardWithReportsMocks(page, { userId }) {
  const me = buildLawyerUser(userId);
  const nowIso = new Date().toISOString();

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }
    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([me]) };
    }
    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(me) };
    }
    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    }
    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "create-activity/") {
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 999, action_type: "other", description: "test", created_at: nowIso }),
      };
    }
    if (apiPath === "processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }
    if (apiPath === "reports/generate-excel/") {
      return {
        status: 200,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: "fake-excel-content",
      };
    }
    return null;
  });
}

async function openReportsTab(page) {
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Feed" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Reportes" }).click();
  await expect(page.getByLabel("Tipo de Reporte")).toBeVisible({ timeout: 10_000 });
}

test.describe("ReportsWidget Advanced Filters", () => {
  test("advanced filter dropdowns appear when Usuarios Registrados report type is selected", {
    tag: ['@flow:dashboard-reports-advanced-filters', '@module:dashboard', '@priority:P2', '@role:lawyer'],
  }, async ({ page }) => {
    const userId = 5100;
    await installDashboardWithReportsMocks(page, { userId });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await openReportsTab(page);

    // Advanced filters should NOT be visible before selecting registered_users
    await expect(page.getByLabel("Rol (Opcional)")).not.toBeVisible();
    await expect(page.getByLabel("Estado del Perfil (Opcional)")).not.toBeVisible();
    await expect(page.getByLabel("Tipo de Documento (Opcional)")).not.toBeVisible();

    // Select registered_users report type
    await page.getByLabel("Tipo de Reporte").selectOption("registered_users");

    // Advanced filter dropdowns should now be visible
    await expect(page.getByLabel("Rol (Opcional)")).toBeVisible();
    await expect(page.getByLabel("Estado del Perfil (Opcional)")).toBeVisible();
    await expect(page.getByLabel("Tipo de Documento (Opcional)")).toBeVisible();
  });

  test("lawyer filters report by role and generates Excel", {
    tag: ['@flow:dashboard-reports-advanced-filters', '@module:dashboard', '@priority:P2', '@role:lawyer'],
  }, async ({ page }) => {
    const userId = 5101;
    await installDashboardWithReportsMocks(page, { userId });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await openReportsTab(page);

    await page.getByLabel("Tipo de Reporte").selectOption("registered_users");
    await expect(page.getByLabel("Rol (Opcional)")).toBeVisible();

    // Select a specific role filter
    await page.getByLabel("Rol (Opcional)").selectOption("client");

    const generateBtn = page.getByRole("button", { name: /Generar y Descargar Reporte/ });
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // Widget should remain visible after generating
    await expect(page.getByLabel("Tipo de Reporte")).toBeVisible({ timeout: 10_000 });
  });

  test("lawyer filters report by profile status and generates Excel", {
    tag: ['@flow:dashboard-reports-advanced-filters', '@module:dashboard', '@priority:P2', '@role:lawyer'],
  }, async ({ page }) => {
    const userId = 5102;
    await installDashboardWithReportsMocks(page, { userId });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await openReportsTab(page);

    await page.getByLabel("Tipo de Reporte").selectOption("registered_users");
    await expect(page.getByLabel("Estado del Perfil (Opcional)")).toBeVisible();

    await page.getByLabel("Estado del Perfil (Opcional)").selectOption("complete");

    const generateBtn = page.getByRole("button", { name: /Generar y Descargar Reporte/ });
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    await expect(page.getByLabel("Tipo de Reporte")).toBeVisible({ timeout: 10_000 });
  });

  test("lawyer filters report by document type and generates Excel", {
    tag: ['@flow:dashboard-reports-advanced-filters', '@module:dashboard', '@priority:P2', '@role:lawyer'],
  }, async ({ page }) => {
    const userId = 5103;
    await installDashboardWithReportsMocks(page, { userId });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await openReportsTab(page);

    await page.getByLabel("Tipo de Reporte").selectOption("registered_users");
    await expect(page.getByLabel("Tipo de Documento (Opcional)")).toBeVisible();

    await page.getByLabel("Tipo de Documento (Opcional)").selectOption("CC");

    const generateBtn = page.getByRole("button", { name: /Generar y Descargar Reporte/ });
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    await expect(page.getByLabel("Tipo de Reporte")).toBeVisible({ timeout: 10_000 });
  });

  test("advanced filters are reset when switching away from Usuarios Registrados", {
    tag: ['@flow:dashboard-reports-advanced-filters', '@module:dashboard', '@priority:P2', '@role:lawyer'],
  }, async ({ page }) => {
    const userId = 5104;
    await installDashboardWithReportsMocks(page, { userId });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await openReportsTab(page);

    // Select registered_users to show advanced filters
    await page.getByLabel("Tipo de Reporte").selectOption("registered_users");
    await expect(page.getByLabel("Rol (Opcional)")).toBeVisible();

    // Switch to another report type
    await page.getByLabel("Tipo de Reporte").selectOption("active_processes");

    // Advanced filters should no longer be visible
    await expect(page.getByLabel("Rol (Opcional)")).not.toBeVisible();
    await expect(page.getByLabel("Estado del Perfil (Opcional)")).not.toBeVisible();
    await expect(page.getByLabel("Tipo de Documento (Opcional)")).not.toBeVisible();

    // Generate button should still be enabled for a valid report type
    const generateBtn = page.getByRole("button", { name: /Generar y Descargar Reporte/ });
    await expect(generateBtn).toBeEnabled();
  });
});
