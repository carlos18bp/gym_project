import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test("client can view document form with variable fields", async ({ page }) => {
  const userId = 8300;

  const doc = buildMockDocument({
    id: 901,
    title: "Contrato de Arrendamiento",
    state: "Published",
    createdBy: 999,
    content: "<p>Contrato entre {{nombre_arrendador}} y {{nombre_arrendatario}}</p>",
    variables: [
      {
        name_es: "Nombre del Arrendador",
        name_en: "Landlord Name",
        field_type: "input",
        value: "",
        tooltip: "Nombre completo del arrendador",
      },
      {
        name_es: "Nombre del Arrendatario",
        name_en: "Tenant Name",
        field_type: "input",
        value: "",
      },
      {
        name_es: "Valor del Arriendo",
        name_en: "Rent Amount",
        field_type: "number",
        value: "",
        currency: "COP",
      },
      {
        name_es: "Fecha de Inicio",
        name_en: "Start Date",
        field_type: "date",
        value: "",
      },
      {
        name_es: "Observaciones",
        name_en: "Notes",
        field_type: "text_area",
        value: "",
      },
    ],
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [doc],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  // Navigate to dashboard first to load documents into the store
  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: /Carpetas/ })).toBeVisible({ timeout: 15_000 });

  // Use client-side navigation to preserve store state
  await page.evaluate(() => {
    window.__vue_router__.push("/dynamic_document_dashboard/document/use/creator/901/Contrato de Arrendamiento");
  }).catch(() => {});
  // Fallback: use hash-based navigation
  await page.evaluate(() => {
    const router = document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$router;
    if (router) router.push('/dynamic_document_dashboard/document/use/creator/901/Contrato de Arrendamiento');
  }).catch(() => {});

  // Should see the document title
  await expect(page.getByRole("heading", { name: "Contrato de Arrendamiento" })).toBeVisible({ timeout: 15_000 });

  // Should see variable labels
  await expect(page.getByText("Nombre del Arrendador")).toBeVisible();
  await expect(page.getByText("Nombre del Arrendatario")).toBeVisible();
  await expect(page.getByText("Valor del Arriendo")).toBeVisible();
  await expect(page.getByText("Fecha de Inicio")).toBeVisible();
  await expect(page.getByText("Observaciones")).toBeVisible();
});

test("client can fill in form variables and see validation", async ({ page }) => {
  const userId = 8301;

  const doc = buildMockDocument({
    id: 902,
    title: "Poder Especial",
    state: "Published",
    createdBy: 999,
    content: "<p>Poder otorgado a {{nombre_apoderado}}</p>",
    variables: [
      {
        name_es: "Nombre del Apoderado",
        name_en: "Attorney Name",
        field_type: "input",
        value: "",
      },
      {
        name_es: "Número de Cédula",
        name_en: "ID Number",
        field_type: "number",
        value: "",
      },
    ],
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "client",
    hasSignature: false,
    documents: [doc],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_profile_completed: true },
  });

  // Navigate to dashboard first to load documents into the store
  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: /Carpetas/ })).toBeVisible({ timeout: 15_000 });

  // Use client-side navigation to preserve store state
  await page.evaluate(() => {
    const router = document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$router;
    if (router) router.push('/dynamic_document_dashboard/document/use/creator/902/Poder Especial');
  }).catch(() => {});

  await expect(page.getByRole("heading", { name: "Poder Especial" })).toBeVisible({ timeout: 15_000 });

  // Fill in form fields
  const nameField = page.locator("#field-0");
  await nameField.fill("Juan Pérez");
  await expect(nameField).toHaveValue("Juan Pérez");

  const idField = page.locator("#field-1");
  await idField.fill("12345678");
  await expect(idField).toHaveValue("12345678");
});

test("lawyer can open document form in editor mode", async ({ page }) => {
  const userId = 8302;

  const doc = buildMockDocument({
    id: 903,
    title: "Tutela Salud",
    state: "Draft",
    createdBy: userId,
    content: "<p>Acción de tutela por {{motivo}}</p>",
    variables: [
      {
        name_es: "Motivo de la Tutela",
        name_en: "Reason",
        field_type: "text_area",
        value: "Negación de tratamiento",
      },
    ],
  });

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [doc],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  // Navigate to dashboard first to load documents into the store
  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Use client-side navigation to preserve store state
  await page.evaluate(() => {
    const router = document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$router;
    if (router) router.push('/dynamic_document_dashboard/document/use/editor/903/Tutela Salud');
  }).catch(() => {});

  await expect(page.getByRole("heading", { name: "Tutela Salud" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Motivo de la Tutela")).toBeVisible();
});
