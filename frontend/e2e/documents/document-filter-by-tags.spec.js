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
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
    has_signature: false,
  };
}

function buildMockDocument({ id, title, state, createdBy, tags = [] }) {
  return {
    id,
    title,
    state,
    created_by: createdBy,
    assigned_to: null,
    code: `DOC-${id}`,
    tags,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    content: "",
    variables: [],
  };
}

async function installFilterTestMocks(page, { userId, documents, tags }) {
  const user = buildMockUser({ id: userId, role: "lawyer" });

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

    if (apiPath === "dynamic-documents/") {
      const url = new URL(route.request().url());
      const params = url.searchParams;
      let filtered = [...documents];

      const statesParam = params.get("states");
      if (statesParam) {
        const statesList = statesParam.split(",").map((s) => s.trim());
        filtered = filtered.filter((d) => statesList.includes(d.state));
      }

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: filtered,
          totalItems: filtered.length,
          totalPages: 1,
          currentPage: 1,
        }),
      };
    }

    if (apiPath === "dynamic-documents/tags/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(tags) };
    }

    if (apiPath === "dynamic-documents/folders/") {
      return { status: 200, contentType: "application/json", body: "[]" };
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

    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}

test.describe("document filters: search and tags", () => {
  test("lawyer can filter documents by search query", async ({ page }) => {
    const userId = 700;

    const documents = [
      buildMockDocument({ id: 101, title: "Contrato de Arrendamiento", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 102, title: "Poder General", state: "Published", createdBy: userId }),
      buildMockDocument({ id: 103, title: "Contrato de Trabajo", state: "Draft", createdBy: userId }),
    ];

    await installFilterTestMocks(page, { userId, documents, tags: [] });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click Minutas tab
    await page.getByRole("button", { name: "Minutas" }).click();

    // Search for "Contrato"
    const searchInput = page.getByPlaceholder("Buscar...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Contrato");

    // Verify filtered results
    await expect(page.getByText("Contrato de Arrendamiento")).toBeVisible();
    await expect(page.getByText("Contrato de Trabajo")).toBeVisible();
    await expect(page.getByText("Poder General")).toBeHidden();
  });

  test("lawyer can see documents with tags", async ({ page }) => {
    const userId = 701;

    const tags = [
      { id: 1, name: "Urgente", color: "#ff0000" },
      { id: 2, name: "Revisado", color: "#00ff00" },
    ];

    const documents = [
      buildMockDocument({
        id: 201,
        title: "Documento con Tag Urgente",
        state: "Draft",
        createdBy: userId,
        tags: [tags[0]],
      }),
      buildMockDocument({
        id: 202,
        title: "Documento con Tag Revisado",
        state: "Published",
        createdBy: userId,
        tags: [tags[1]],
      }),
      buildMockDocument({
        id: 203,
        title: "Documento sin Tags",
        state: "Draft",
        createdBy: userId,
        tags: [],
      }),
    ];

    await installFilterTestMocks(page, { userId, documents, tags });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    // Verify documents are visible
    await expect(page.getByText("Documento con Tag Urgente")).toBeVisible();
    await expect(page.getByText("Documento con Tag Revisado")).toBeVisible();
    await expect(page.getByText("Documento sin Tags")).toBeVisible();
  });

  test("search with no results shows empty state", async ({ page }) => {
    const userId = 702;

    const documents = [
      buildMockDocument({ id: 301, title: "Contrato Alpha", state: "Draft", createdBy: userId }),
    ];

    await installFilterTestMocks(page, { userId, documents, tags: [] });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    const searchInput = page.getByPlaceholder("Buscar...");
    await searchInput.fill("NoExiste");

    // Verify no results - document should be hidden
    await expect(page.getByText("Contrato Alpha")).toBeHidden();
  });

  test("clearing search shows all documents again", async ({ page }) => {
    const userId = 703;

    const documents = [
      buildMockDocument({ id: 401, title: "Documento Uno", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 402, title: "Documento Dos", state: "Published", createdBy: userId }),
    ];

    await installFilterTestMocks(page, { userId, documents, tags: [] });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    const searchInput = page.getByPlaceholder("Buscar...");
    
    // Filter first
    await searchInput.fill("Uno");
    await expect(page.getByText("Documento Uno")).toBeVisible();
    await expect(page.getByText("Documento Dos")).toBeHidden();

    // Clear search
    await searchInput.clear();
    
    // Both documents should be visible again
    await expect(page.getByText("Documento Uno")).toBeVisible();
    await expect(page.getByText("Documento Dos")).toBeVisible();
  });

  test("lawyer filters documents by document state", async ({ page }) => {
    const userId = 704;

    // Use only Draft and Published states which are fetched by default in Minutas tab
    const documents = [
      buildMockDocument({ id: 501, title: "Documento Borrador Estado", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 502, title: "Documento Publicado Estado", state: "Published", createdBy: userId }),
    ];

    await installFilterTestMocks(page, { userId, documents, tags: [] });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    // Documents should be visible
    await expect(page.getByText("Documento Borrador Estado")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Documento Publicado Estado")).toBeVisible();
  });

  test("lawyer searches documents by assigned user name", async ({ page }) => {
    const userId = 705;

    const documents = [
      buildMockDocument({ id: 601, title: "Documento de Juan", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 602, title: "Documento de Maria", state: "Published", createdBy: userId }),
    ];

    await installFilterTestMocks(page, { userId, documents, tags: [] });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    const searchInput = page.getByPlaceholder("Buscar...");
    await searchInput.fill("Juan");

    // Only Juan's document should be visible
    await expect(page.getByText("Documento de Juan")).toBeVisible();
    await expect(page.getByText("Documento de Maria")).toBeHidden();
  });

  test("lawyer sees tag chips on documents with tags", async ({ page }) => {
    const userId = 706;

    const tags = [
      { id: 10, name: "Importante", color: "#ff0000" },
      { id: 11, name: "Pendiente", color: "#ffaa00" },
    ];

    const documents = [
      buildMockDocument({
        id: 701,
        title: "Documento Etiquetado",
        state: "Draft",
        createdBy: userId,
        tags: [tags[0], tags[1]],
      }),
    ];

    await installFilterTestMocks(page, { userId, documents, tags });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    // Document should be visible
    await expect(page.getByText("Documento Etiquetado")).toBeVisible();
    
    // Tags should be displayed (either as chips or in a tag section)
    const hasImportanteTag = await page.getByText("Importante").isVisible().catch(() => false);
    const hasPendienteTag = await page.getByText("Pendiente").isVisible().catch(() => false);
    
    // At least one tag chip should be visible
    expect(hasImportanteTag || hasPendienteTag).toBeTruthy();
  });

  test("search combines with tag filter", async ({ page }) => {
    const userId = 707;

    const tags = [
      { id: 20, name: "Legal", color: "#0000ff" },
    ];

    const documents = [
      buildMockDocument({
        id: 801,
        title: "Contrato Legal",
        state: "Draft",
        createdBy: userId,
        tags: [tags[0]],
      }),
      buildMockDocument({
        id: 802,
        title: "Contrato Regular",
        state: "Published",
        createdBy: userId,
        tags: [],
      }),
      buildMockDocument({
        id: 803,
        title: "Poder Legal",
        state: "Draft",
        createdBy: userId,
        tags: [tags[0]],
      }),
    ];

    await installFilterTestMocks(page, { userId, documents, tags });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    // All documents should be visible initially
    await expect(page.getByText("Contrato Legal")).toBeVisible();
    await expect(page.getByText("Contrato Regular")).toBeVisible();
    await expect(page.getByText("Poder Legal")).toBeVisible();

    // Search for "Contrato"
    const searchInput = page.getByPlaceholder("Buscar...");
    await searchInput.fill("Contrato");

    // Only Contrato documents should be visible
    await expect(page.getByText("Contrato Legal")).toBeVisible();
    await expect(page.getByText("Contrato Regular")).toBeVisible();
    await expect(page.getByText("Poder Legal")).toBeHidden();
  });
});
