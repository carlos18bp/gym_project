import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
import {
  buildMockUser,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

async function installBasicUserDocsMocks(page, { userId, lawyerId }) {
  const basic = { ...buildMockUser({ id: userId, role: "client", hasSignature: false }), role: "basic" };
  const lawyer = buildMockUser({ id: lawyerId, role: "lawyer", hasSignature: true });
  const nowIso = new Date().toISOString();

  // "Progress" state + assigned_to makes the doc show up on the basic user's
  // "Mis Documentos" tab (client view lists Progress/Completed assigned docs).
  const assignedDoc = buildMockDocument({
    id: 1201,
    title: "Documento Para Básico",
    state: "Progress",
    createdBy: lawyerId,
    assignedTo: userId,
  });

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([basic, lawyer]) };
    }

    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(basic) };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    }

    if (apiPath === "dynamic-documents/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([assignedDoc]) };
    }

    if (apiPath.startsWith("dynamic-documents/user/")) {
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

test("basic user can access documents dashboard", { tag: ['@flow:basic-restrictions', '@module:auth', '@priority:P3', '@role:basic'] }, async ({ page }) => {
  const userId = 9600;
  const lawyerId = 9601;

  await installBasicUserDocsMocks(page, { userId, lawyerId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "basic", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  // The client-style dashboard renders its navigation tabs for the basic role
  await expect(page.getByRole("button", { name: "Carpetas" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Mis Documentos" })).toBeVisible();

  // The document assigned to the basic user is listed under "Mis Documentos"
  await page.getByRole("button", { name: "Mis Documentos" }).click();
  await expect(page.getByRole("table").getByText("Documento Para Básico")).toBeVisible({ timeout: 15_000 });
});

test("basic user session state reflects limited access role", { tag: ['@flow:basic-restrictions', '@module:auth', '@priority:P3', '@role:basic'] }, async ({ page }) => {
  // audit: load-only flow (role restriction — the subscription lock is a
  // disabled control, so there is no interaction available to the basic user)
  const userId = 9602;
  const lawyerId = 9603;

  await installBasicUserDocsMocks(page, { userId, lawyerId });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "basic", is_gym_lawyer: false, is_profile_completed: true, has_signature: false },
  });

  await page.goto("/dynamic_document_dashboard");

  // Dashboard action bar renders for the basic role
  await expect(page.getByRole("button", { name: "Firma Electrónica" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Firma Electrónica" })).toBeEnabled();

  // The letterhead feature is locked for basic users (subscription restriction)
  await expect(page.getByRole("button", { name: "Membrete Global" })).toBeDisabled();
});
