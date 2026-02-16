import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("lawyer can open Dynamic Documents dashboard and switch to Folders tab", async ({ page }) => {
  const userId = 500;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Carpetas" })).toBeVisible();

  await page.getByRole("button", { name: "Carpetas" }).click();

  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible();
  await expect(page.getByText("Carpeta 1")).toBeVisible();
});

test("lawyer can search Minutas by title", async ({ page }) => {
  const userId = 501;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: false,
    documents: [
      {
        id: 101,
        title: "Minuta Alpha",
        state: "Draft",
        created_by: userId,
        assigned_to: null,
        code: "DOC-101",
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        content: "",
        variables: [],
      },
      {
        id: 102,
        title: "Minuta Beta",
        state: "Published",
        created_by: userId,
        assigned_to: null,
        code: "DOC-102",
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        content: "",
        variables: [],
      },
    ],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible();
  await page.getByRole("button", { name: "Minutas" }).click();

  const search = page.getByPlaceholder("Buscar...");
  await expect(search).toBeVisible();

  await search.fill("Alpha");

  await expect(page.getByText("Minuta Alpha")).toBeVisible();
  await expect(page.getByText("Minuta Beta")).toBeHidden();
});

test("lawyer can open folder details modal from Folders tab", async ({ page }) => {
  const userId = 502;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible();

  await page.getByText("Carpeta 1", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Carpeta 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agregar documentos" }).first()).toBeVisible();
  await expect(page.getByText("Minuta A")).toBeVisible();
  await expect(page.getByText("Borrador")).toBeVisible();
});

test("client can open My Documents tab and search documents", async ({ page }) => {
  const userId = 503;

  const documents = [
    buildMockDocument({
      id: 301,
      title: "Contrato Cliente Alpha",
      state: "Progress",
      createdBy: 999,
      assignedTo: userId,
    }),
    buildMockDocument({
      id: 302,
      title: "Contrato Cliente Beta",
      state: "Completed",
      createdBy: 999,
      assignedTo: userId,
    }),
    // A template that should not appear in client "Mis Documentos" list
    buildMockDocument({
      id: 303,
      title: "Plantilla Publicada",
      state: "Published",
      createdBy: 999,
      assignedTo: null,
    }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await expect(page.getByRole("button", { name: "Mis Documentos" })).toBeVisible();
  await page.getByRole("button", { name: "Mis Documentos" }).click();

  const search = page.getByPlaceholder("Buscar...").first();
  await expect(search).toBeVisible();

  await expect(page.getByText("Contrato Cliente Alpha")).toBeVisible();
  await expect(page.getByText("Contrato Cliente Beta")).toBeVisible();
  await expect(page.getByText("Plantilla Publicada")).toBeHidden();

  await search.fill("Alpha");
  await expect(page.getByText("Contrato Cliente Alpha")).toBeVisible();
  await expect(page.getByText("Contrato Cliente Beta")).toBeHidden();
});

test("client can start a new document from a published template", async ({ page }) => {
  const userId = 504;
  const templateId = 401;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [
      buildMockDocument({
        id: templateId,
        title: "Plantilla de Prueba",
        state: "Published",
        createdBy: 999,
        assignedTo: null,
        variables: [
          {
            name_en: "name",
            name_es: "Nombre",
            field_type: "input",
            value: "",
            tooltip: "",
            select_options: null,
            summary_field: "none",
            currency: null,
          },
        ],
      }),
    ],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await page.getByRole("button", { name: "Nuevo Documento" }).click();

  await expect(page.getByRole("button", { name: "Volver a Mis Documentos" })).toBeVisible();
  await expect(page.getByText("Plantilla de Prueba")).toBeVisible();

  await page.getByText("Plantilla de Prueba", { exact: true }).click();

  const nameInput = page.locator("#document-name");
  await expect(nameInput).toBeVisible();
  await nameInput.fill("Documento Generado");

  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/dynamic_document_dashboard/document/use/creator/${templateId}/Documento%20Generado`)
  );
  await expect(page.getByRole("heading", { name: "Documento Generado" })).toBeVisible();
});
