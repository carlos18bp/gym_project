import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

function buildMockUser({ id, role }) {
  return {
    id,
    first_name: "E2E",
    last_name: role === "lawyer" ? "Lawyer" : "Client",
    email: "e2e@example.com",
    role,
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    created_at: new Date().toISOString(),
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
    has_signature: false,
  };
}

async function installDashboardWithReportsMocks(page, { userId, role, reportResponse }) {
  const me = buildMockUser({ id: userId, role });
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

    // Reports endpoint
    if (apiPath === "reports/generate-excel/") {
      if (reportResponse === "error") {
        return { status: 500, contentType: "application/json", body: JSON.stringify({ error: "Error al generar el reporte" }) };
      }
      // Return a small blob-like response for success
      return {
        status: 200,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        body: "fake-excel-content",
      };
    }

    return null;
  });
}

test("lawyer navigates to Reportes tab and generates an Excel report", async ({ page }) => {
  const userId = 4100;

  await installDashboardWithReportsMocks(page, {
    userId,
    role: "lawyer",
    reportResponse: "success",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dashboard");

  // Wait for dashboard to render
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  // Wait for ActivityFeed tabs to render, then click Reportes tab
  await expect(page.getByRole("button", { name: "Feed" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Reportes" }).click();

  // ReportsWidget should render with the report type selector
  await expect(page.getByLabel("Tipo de Reporte")).toBeVisible({ timeout: 10_000 });

  // Select a report type
  await page.getByLabel("Tipo de Reporte").selectOption("active_processes");

  // The generate button should now be enabled
  const generateBtn = page.getByRole("button", { name: /Generar y Descargar Reporte/ });
  await expect(generateBtn).toBeEnabled();

  // Click generate — the store calls axios.post which our mock handles
  await generateBtn.click();

  // After clicking, the widget stays on the Reportes tab
  await expect(page.getByLabel("Tipo de Reporte")).toBeVisible({ timeout: 10_000 });
});

test("lawyer sees validation when only one date is provided", async ({ page }) => {
  const userId = 4101;

  await installDashboardWithReportsMocks(page, {
    userId,
    role: "lawyer",
    reportResponse: "success",
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dashboard");

  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  // Wait for ActivityFeed tabs to render, then click Reportes tab
  await expect(page.getByRole("button", { name: "Feed" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Reportes" }).click();

  await expect(page.getByLabel("Tipo de Reporte")).toBeVisible({ timeout: 10_000 });

  // Select report type
  await page.getByLabel("Tipo de Reporte").selectOption("active_processes");

  // Fill only start date (not end date)
  await page.locator("#startDate").fill("2026-01-01");

  // Validation message should appear
  await expect(page.getByText("Si proporcionas una fecha, debes proporcionar ambas fechas")).toBeVisible();

  // Generate button should be disabled because form is invalid
  const generateBtn = page.getByRole("button", { name: /Generar y Descargar Reporte/ });
  await expect(generateBtn).toBeDisabled();

  // Fill end date too — validation should disappear and button should enable
  await page.locator("#endDate").fill("2026-01-31");

  await expect(page.getByText("Si proporcionas una fecha, debes proporcionar ambas fechas")).toBeHidden();
  await expect(generateBtn).toBeEnabled();
});
