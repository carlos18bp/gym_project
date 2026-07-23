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

test("clicking a legal update link opens the external source in a new tab", { tag: ['@flow:dashboard-legal-updates', '@module:dashboard', '@priority:P3', '@role:shared'] }, async ({ page }) => {
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

  // The external source is stubbed so the click never leaves the harness
  await page.context().route("https://example.com/**", async (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Reforma</h1>" })
  );

  await page.goto("/dashboard");

  // Starting point: the carousel shows the first update and its link
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Nueva reforma tributaria aprobada en Colombia")).toBeVisible({ timeout: 10_000 });

  const link = page.getByRole("link", { name: "Leer reforma completa" });
  await expect(link).toHaveAttribute("href", "https://example.com/reforma");

  const popupPromise = page.waitForEvent("popup");
  await link.click();

  // Transition: a new tab opens on the linked source
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://example.com/reforma");
});

test("dashboard renders empty state when no legal updates exist", { tag: ['@flow:dashboard-legal-updates', '@module:dashboard', '@priority:P3', '@role:shared'] }, async ({ page }) => {
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

test("client also sees legal updates on dashboard", { tag: ['@flow:dashboard-legal-updates', '@module:dashboard', '@priority:P3', '@role:shared'] }, async ({ page }) => {
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

  // Starting point: the client is on the process list, no legal updates in sight
  await page.goto("/process_list");
  await expect(page.getByPlaceholder("Buscar procesos...")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Información importante para clientes")).toHaveCount(0);

  // quality: allow-fragile-selector (the desktop sidebar has no role/testid of its own; this is the established locator across dashboard specs)
  const sidebar = page.locator("div.lg\\:fixed.lg\\:inset-y-0");
  await sidebar.getByRole("link", { name: "Inicio", exact: true }).click();

  // Transition: the dashboard renders and the client sees the legal update
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Información importante para clientes")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Consultar normativa")).toBeVisible();
});
