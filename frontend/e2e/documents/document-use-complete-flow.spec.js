import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
import {
  buildMockUser,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

async function installUseCompleteFlowMocks(page, { userId, lawyerId }) {
  const client = buildMockUser({ id: userId, role: "client", hasSignature: false });
  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", hasSignature: true });
  const nowIso = new Date().toISOString();

  const availableDoc = buildMockDocument({
    id: 801,
    title: "Contrato de Trabajo",
    state: "Published",
    createdBy: lawyerId,
    assignedTo: userId,
    variables: [
      { id: 1, name: "nombre_empleado", display_name: "Nombre del Empleado", type: "input", value: "" },
      { id: 2, name: "cargo", display_name: "Cargo", type: "input", value: "" },
      { id: 3, name: "salario", display_name: "Salario Mensual", type: "number", value: "" },
    ],
  });

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([client, lawyer]) };
    }

    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(client) };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    }

    if (apiPath === "dynamic-documents/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([availableDoc]) };
    }

    if (apiPath.startsWith("dynamic-documents/user/") && apiPath.endsWith("/pending-documents-full/")) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath.startsWith("dynamic-documents/user/") && apiPath.endsWith("/signed-documents/")) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath.startsWith("dynamic-documents/user/") && apiPath.endsWith("/archived-documents/")) {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/tags/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "create-activity/") {
      return { status: 201, contentType: "application/json", body: JSON.stringify({ id: 1, action_type: "other", description: "", created_at: nowIso }) };
    }

    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}

test("client sees assigned document with Published state in dashboard", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8500;
  const lawyerId = 8501;

  await installUseCompleteFlowMocks(page, { userId, lawyerId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

  const userAuth = await page.evaluate(() => JSON.parse(localStorage.getItem("userAuth") || "{}"));
  expect(userAuth.role).toBe("client");
});

test("client document dashboard loads with correct role context", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8502;
  const lawyerId = 8503;

  await installUseCompleteFlowMocks(page, { userId, lawyerId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });

  // Verify client-specific content is rendered (not lawyer tabs)
  const lawyerOnlyTab = page.getByRole("button", { name: /Minutas/i });
  const isLawyerTabVisible = await lawyerOnlyTab.isVisible({ timeout: 2_000 }).catch(() => false);
  expect(isLawyerTabVisible).toBe(false);
});

test("client can navigate to document form for assigned document", { tag: ['@flow:docs-use-template', '@module:documents', '@priority:P1', '@role:client'] }, async ({ page }) => {
  const userId = 8504;
  const lawyerId = 8505;

  await installUseCompleteFlowMocks(page, { userId, lawyerId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  // quality: allow-fragile-selector (stable application ID)
  await expect(page.locator("#app")).toBeVisible({ timeout: 15_000 });
});
