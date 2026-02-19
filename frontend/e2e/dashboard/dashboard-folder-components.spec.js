import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  buildMockDocument,
  buildMockUser,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for dashboard folder/contact flows with behavior assertions.
 *
 * Coverage targets:
 * - Folder management UI flows (folders table + details modal + empty state create flow)
 * - Contacts widget rendering in ActivityFeed tabs
 */

const lawyerAuth = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
});

const clientAuth = (userId) => ({
  token: "e2e-token",
  userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
});

function buildDashboardUser({ id, firstName, lastName, email, role }) {
  return {
    id,
    first_name: firstName,
    last_name: lastName,
    email,
    role,
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    is_profile_completed: true,
    is_gym_lawyer: role === "lawyer",
    has_signature: role === "lawyer",
  };
}

function applyDocumentFilters(documents, requestUrl) {
  const url = new URL(requestUrl);
  const params = url.searchParams;
  let filtered = [...documents];

  const state = params.get("state");
  const states = params.get("states");
  const unassigned = params.get("unassigned") === "true";

  if (states) {
    const allowedStates = states.split(",").map((value) => value.trim());
    filtered = filtered.filter((doc) => allowedStates.includes(doc.state));
  } else if (state) {
    filtered = filtered.filter((doc) => doc.state === state);
  }

  if (unassigned) {
    filtered = filtered.filter((doc) => !doc.assigned_to);
  }

  return filtered;
}

async function installDashboardComponentMocks(
  page,
  {
    userId,
    role = "lawyer",
    documents = [],
    folders = [],
    contacts = [],
    legalUpdates = [],
  }
) {
  const user = buildMockUser({ id: userId, role, hasSignature: role === "lawyer" });
  const nowIso = new Date().toISOString();

  let folderList = [...folders];
  let folderIdSeq = 1000;

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };

    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([user, ...contacts]),
      };
    }

    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === `users/${userId}/signature/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_signature: role === "lawyer" }),
      };
    }

    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    if (apiPath === "dynamic-documents/") {
      const filtered = applyDocumentFilters(documents, route.request().url());
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

    if (apiPath.match(/^dynamic-documents\/\d+\/$/)) {
      const docId = Number(apiPath.match(/^dynamic-documents\/(\d+)\/$/)[1]);
      const document = documents.find((doc) => doc.id === docId);
      if (document) {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(document),
        };
      }
    }

    if (apiPath === "dynamic-documents/folders/") {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON?.() || {};
        const newFolder = buildMockFolder({
          id: folderIdSeq,
          name: payload.name || "Nueva Carpeta",
          colorId: payload.color_id || 0,
          documents: [],
        });
        folderIdSeq += 1;
        folderList.push(newFolder);

        return {
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(newFolder),
        };
      }

      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(folderList),
      };
    }

    if (apiPath === "dynamic-documents/folders/create/" && route.request().method() === "POST") {
      const payload = route.request().postDataJSON?.() || {};
      const newFolder = buildMockFolder({
        id: folderIdSeq,
        name: payload.name || "Nueva Carpeta",
        colorId: payload.color_id || 0,
        documents: [],
      });
      folderIdSeq += 1;
      folderList.push(newFolder);

      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newFolder),
      };
    }

    if (apiPath.match(/^dynamic-documents\/folders\/\d+\/$/)) {
      const folderId = Number(apiPath.match(/^dynamic-documents\/folders\/(\d+)\/$/)[1]);
      const folder = folderList.find((item) => item.id === folderId);
      if (folder) {
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(folder),
        };
      }
    }

    if (apiPath.match(/^dynamic-documents\/folders\/\d+\/update\/$/) && route.request().method() === "PATCH") {
      const folderId = Number(apiPath.match(/^dynamic-documents\/folders\/(\d+)\/update\/$/)[1]);
      const payload = route.request().postDataJSON?.() || {};
      const index = folderList.findIndex((item) => item.id === folderId);

      if (index >= 0) {
        const current = folderList[index];
        const nextDocumentIds = payload.document_ids || current.document_ids || [];
        const nextDocuments = documents.filter((doc) => nextDocumentIds.includes(doc.id));

        const updatedFolder = {
          ...current,
          ...payload,
          document_ids: nextDocumentIds,
          documents: nextDocuments,
        };

        folderList[index] = updatedFolder;

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(updatedFolder),
        };
      }
    }

    if (apiPath.match(/^dynamic-documents\/folders\/\d+\/delete\/$/) && route.request().method() === "DELETE") {
      const folderId = Number(apiPath.match(/^dynamic-documents\/folders\/(\d+)\/delete\/$/)[1]);
      folderList = folderList.filter((item) => item.id !== folderId);
      return { status: 204, contentType: "application/json", body: "" };
    }

    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/permissions/clients/") return { status: 200, contentType: "application/json", body: JSON.stringify({ clients: [] }) };
    if (apiPath === "dynamic-documents/permissions/roles/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath.match(/^dynamic-documents\/\d+\/permissions\/$/)) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_public: false,
          visibility_user_ids: [],
          usability_user_ids: [],
          visibility_roles: [],
          usability_roles: [],
        }),
      };
    }

    if (apiPath === "contacts/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(contacts) };
    }

    if (apiPath === "user-activities/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "create-activity/") {
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "view", description: "", created_at: nowIso }),
      };
    }
    if (apiPath === "recent-processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "processes/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/recent/") return { status: 200, contentType: "application/json", body: "[]" };
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

test("folders tab renders folder row and folder details with real document data", async ({ page }) => {
  const userId = 10700;
  const documents = [
    buildMockDocument({ id: 1, title: "Contrato laboral base", state: "Draft", createdBy: userId }),
    buildMockDocument({ id: 2, title: "Poder especial", state: "Published", createdBy: userId }),
  ];

  const folders = [
    buildMockFolder({
      id: 200,
      name: "Carpeta Contratos",
      colorId: 1,
      documents,
    }),
  ];

  await installDashboardComponentMocks(page, { userId, documents, folders, role: "lawyer" });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Carpetas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible();

  const folderRow = page.getByRole("row", { name: /Carpeta Contratos/i });
  await expect(folderRow).toBeVisible();
  await expect(folderRow).toContainText("2 documentos");

  await folderRow.click();

  await expect(page.getByRole("heading", { name: "Carpeta Contratos" })).toBeVisible();
  await expect(page.getByText("Contrato laboral base")).toBeVisible();
  await expect(page.getByText("Poder especial")).toBeVisible();
});

test("empty folders state exposes first-folder CTA and opens create modal", async ({ page }) => {
  const userId = 10701;

  await installDashboardComponentMocks(page, {
    userId,
    documents: [],
    folders: [],
    role: "lawyer",
  });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dynamic_document_dashboard");
  await page.getByRole("button", { name: "Carpetas" }).click();

  await expect(page.getByText("No tienes carpetas aún")).toBeVisible();

  await page.getByRole("button", { name: "Crear Primera Carpeta" }).click();

  await expect(page.getByRole("heading", { name: "Nueva Carpeta" })).toBeVisible();
  await expect(page.getByLabel("Nombre de la carpeta")).toBeVisible();
});

test("dashboard contacts tab shows contact list for lawyer users", async ({ page }) => {
  const userId = 10702;
  const contacts = [
    buildDashboardUser({
      id: 9101,
      firstName: "Carla",
      lastName: "Cliente",
      email: "carla.cliente@example.test",
      role: "client",
    }),
    buildDashboardUser({
      id: 9102,
      firstName: "Luis",
      lastName: "Litigante",
      email: "luis.litigante@example.test",
      role: "lawyer",
    }),
  ];

  await installDashboardComponentMocks(page, {
    userId,
    role: "lawyer",
    contacts,
    legalUpdates: [
      {
        id: 1,
        content: "Actualización legal para dashboard",
        link_text: "Ver detalle",
        link_url: "https://example.test/update",
        is_active: true,
      },
    ],
  });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dashboard");
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Contactos" }).click();

  await expect(page.getByText("Carla Cliente")).toBeVisible();
  await expect(page.getByText("carla.cliente@example.test")).toBeVisible();
  await expect(page.getByText("Luis Litigante")).toBeVisible();
  await expect(page.getByText("No hay contactos disponibles.")).toHaveCount(0);
});

test("dashboard contacts tab shows empty state when lawyer has no contacts", async ({ page }) => {
  const userId = 10703;

  await installDashboardComponentMocks(page, {
    userId,
    role: "lawyer",
    contacts: [],
    legalUpdates: [],
  });
  await setAuthLocalStorage(page, lawyerAuth(userId));

  await page.goto("/dashboard");
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Contactos" }).click();
  await expect(page.getByText("No hay contactos disponibles.")).toBeVisible();
});

test("dashboard contacts tab for client user shows lawyers label and data", async ({ page }) => {
  const userId = 10704;
  const contacts = [
    buildDashboardUser({
      id: 9201,
      firstName: "Laura",
      lastName: "Abogada",
      email: "laura.abogada@example.test",
      role: "lawyer",
    }),
  ];

  await installDashboardComponentMocks(page, {
    userId,
    role: "client",
    contacts,
    legalUpdates: [],
  });
  await setAuthLocalStorage(page, clientAuth(userId));

  await page.goto("/dashboard");
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Abogados" }).click();
  await expect(page.getByText("Laura Abogada")).toBeVisible();
  await expect(page.getByText("laura.abogada@example.test")).toBeVisible();
});
