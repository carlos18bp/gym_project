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
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
    has_signature: false,
  };
}

function buildMockLegalUpdate({ id, title, content, isActive = true, imageUrl = null }) {
  return {
    id,
    title,
    content,
    is_active: isActive,
    image: imageUrl,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// NOTE: the legalUpdate store exposes create/update/delete actions, but no UI
// component drives them (LegalUpdatesCard.vue is display-only). These tests
// therefore cover the only reachable flow: displaying active legal updates on
// the dashboard carousel.
async function installLegalUpdateMocks(page, { userId, role, updates = [] }) {
  const user = buildMockUser({ id: userId, role });
  const legalUpdates = [...updates];

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "users/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    }

    if (apiPath === `users/${userId}/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ has_signature: false }) };
    }

    if (apiPath === "legal-updates/active/") {
      const activeUpdates = legalUpdates.filter((u) => u.is_active);
      return { status: 200, contentType: "application/json", body: JSON.stringify(activeUpdates) };
    }

    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}

test.describe("legal updates: display and CRUD", { tag: ['@flow:dashboard-legal-updates', '@module:dashboard', '@priority:P3', '@role:shared'] }, () => {
  test("lawyer advances the carousel to the second active legal update", { tag: ['@flow:dashboard-legal-updates', '@module:dashboard', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 1200;

    const updates = [
      buildMockLegalUpdate({
        id: 1,
        title: "Nueva Ley de Protección de Datos",
        content: "Se ha aprobado una nueva ley que regula el tratamiento de datos personales.",
        isActive: true,
      }),
      buildMockLegalUpdate({
        id: 2,
        title: "Actualización Código Civil",
        content: "Modificaciones importantes al código civil.",
        isActive: true,
      }),
    ];

    await installLegalUpdateMocks(page, {
      userId,
      role: "lawyer",
      updates,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");

    // Starting point: the carousel opens on the first active update
    // quality: allow-fragile-selector (Swiper exposes the active slide only through its own class)
    const activeSlide = page.locator(".swiper-slide-active");
    await expect(activeSlide).toHaveText(/Se ha aprobado una nueva ley que regula el tratamiento de datos personales\./, { timeout: 15_000 });

    // quality: allow-fragile-selector (Swiper pagination bullets carry no role or testid)
    await page.locator(".swiper-pagination-bullet").nth(1).click();

    // Transition: the second active update becomes the visible slide
    await expect(activeSlide).toHaveText(/Modificaciones importantes al código civil\./, { timeout: 10_000 });
  });

  test("dashboard shows empty state when no legal updates", { tag: ['@flow:dashboard-legal-updates', '@module:dashboard', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 1201;

    await installLegalUpdateMocks(page, {
      userId,
      role: "lawyer",
      updates: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Page should load successfully even without updates
    await expect(page.getByText("Procesos activos").or(page.getByText("Bienvenido"))).toBeVisible();
  });

  test("only active updates are displayed", { tag: ['@flow:dashboard-legal-updates', '@module:dashboard', '@priority:P3', '@role:shared'] }, async ({ page }) => {
    const userId = 1202;

    const updates = [
      buildMockLegalUpdate({
        id: 3,
        title: "Actualización Activa",
        content: "Esta actualización está activa.",
        isActive: true,
      }),
      buildMockLegalUpdate({
        id: 4,
        title: "Actualización Inactiva",
        content: "Esta actualización está inactiva.",
        isActive: false,
      }),
    ];

    await installLegalUpdateMocks(page, {
      userId,
      role: "lawyer",
      updates,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Only the active update's content renders in the carousel
    await expect(page.getByText("Esta actualización está activa.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Esta actualización está inactiva.")).toHaveCount(0);
  });
});
