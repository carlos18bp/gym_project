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

function buildMockLegalUpdate({ id, content, linkText, linkUrl, isActive = true }) {
  return {
    id,
    title: `Update ${id}`,
    content,
    link_text: linkText || "Ver más",
    link_url: linkUrl || "https://example.com",
    image: null,
    is_active: isActive,
    created_at: new Date().toISOString(),
  };
}

async function installDashboardWithLegalUpdatesMocks(page, { userId, role, legalUpdates = [] }) {
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
        body: JSON.stringify({ id: 999, action_type: "other", description: "", created_at: nowIso }),
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
    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    // Legal updates endpoint
    if (apiPath === "legal-updates/active/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(legalUpdates),
      };
    }

    return null;
  });
}

test("dashboard renders legal updates carousel with content and links", async ({ page }) => {
  const userId = 4200;

  const updates = [
    buildMockLegalUpdate({
      id: 1,
      content: "Nueva reforma tributaria aprobada en Colombia para el año 2026.",
      linkText: "Leer reforma completa",
      linkUrl: "https://example.com/reforma",
    }),
    buildMockLegalUpdate({
      id: 2,
      content: "Actualización del código de procedimiento laboral colombiano.",
      linkText: "Ver detalles",
      linkUrl: "https://example.com/laboral",
    }),
  ];

  await installDashboardWithLegalUpdatesMocks(page, {
    userId,
    role: "lawyer",
    legalUpdates: updates,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dashboard");

  // Wait for dashboard to load
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  // Legal updates carousel should render with the first update content
  await expect(page.getByText("Nueva reforma tributaria aprobada en Colombia")).toBeVisible({ timeout: 10_000 });

  // The link should be visible and have the correct text
  await expect(page.getByText("Leer reforma completa")).toBeVisible();

  // Verify the link has the correct href
  const link = page.getByText("Leer reforma completa");
  await expect(link).toHaveAttribute("href", "https://example.com/reforma");
});

test("dashboard renders empty state when no legal updates exist", async ({ page }) => {
  const userId = 4201;

  await installDashboardWithLegalUpdatesMocks(page, {
    userId,
    role: "lawyer",
    legalUpdates: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dashboard");

  // Dashboard should load successfully
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  // The carousel should NOT show any legal update content
  await expect(page.getByText("Nueva reforma tributaria")).toHaveCount(0);

  // The LegalUpdatesCard renders a Swiper — with no slides, nothing should appear
  // Dashboard should still function correctly without legal updates
  await expect(page.getByText("Feed")).toBeVisible();
});

test("client also sees legal updates on dashboard", async ({ page }) => {
  const userId = 4202;

  const updates = [
    buildMockLegalUpdate({
      id: 10,
      content: "Información importante para clientes sobre protección de datos personales.",
      linkText: "Consultar normativa",
    }),
  ];

  await installDashboardWithLegalUpdatesMocks(page, {
    userId,
    role: "client",
    legalUpdates: updates,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dashboard");

  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  // Client should see the legal update content
  await expect(page.getByText("Información importante para clientes")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Consultar normativa")).toBeVisible();
});
