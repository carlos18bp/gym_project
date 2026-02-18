import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

async function setDashboardSearchQuery(page, query) {
  await page.evaluate((value) => {
    const root = document.querySelector(".folder-management") || document.querySelector("#app");
    let comp = root && (root.__vueParentComponent || root.__vue_app__?._instance);
    const seen = new Set();

    while (comp && !seen.has(comp)) {
      seen.add(comp);

      const setupState = comp.setupState || {};
      if (Object.prototype.hasOwnProperty.call(setupState, "searchQuery")) {
        const target = setupState.searchQuery;
        if (target && typeof target === "object" && "value" in target) {
          target.value = value;
        } else {
          setupState.searchQuery = value;
        }
        return;
      }

      const hasProp = comp.props && Object.prototype.hasOwnProperty.call(comp.props, "searchQuery");
      if (!hasProp && comp.proxy && Object.prototype.hasOwnProperty.call(comp.proxy, "searchQuery")) {
        comp.proxy.searchQuery = value;
        return;
      }

      comp = comp.parent;
    }

    throw new Error("searchQuery not found");
  }, query);

  await page.waitForFunction((value) => {
    const root = document.querySelector(".folder-management") || document.querySelector("#app");
    let comp = root && (root.__vueParentComponent || root.__vue_app__?._instance);
    const seen = new Set();

    while (comp && !seen.has(comp)) {
      seen.add(comp);

      const setupState = comp.setupState || {};
      if (Object.prototype.hasOwnProperty.call(setupState, "searchQuery")) {
        const target = setupState.searchQuery;
        if (target && typeof target === "object" && "value" in target) {
          return target.value === value;
        }
        return target === value;
      }

      const hasProp = comp.props && Object.prototype.hasOwnProperty.call(comp.props, "searchQuery");
      if (!hasProp && comp.proxy && Object.prototype.hasOwnProperty.call(comp.proxy, "searchQuery")) {
        return comp.proxy.searchQuery === value;
      }

      comp = comp.parent;
    }

    return false;
  }, query);
}

test("folders table opens create modal from empty state CTA", async ({ page }) => {
  const userId = 9100;

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [],
    folders: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("No tienes carpetas aún")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Crear Primera Carpeta" }).click();
  await expect(page.getByRole("heading", { name: "Nueva Carpeta" })).toBeVisible({ timeout: 10_000 });
});

test("folders table filters rows from search query", async ({ page }) => {
  const userId = 9101;

  const folders = [
    buildMockFolder({ id: 801, name: "Carpeta Contratos", colorId: 1 }),
    buildMockFolder({ id: 802, name: "Carpeta Finanzas", colorId: 2 }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [],
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Carpeta Contratos")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Carpeta Finanzas")).toBeVisible({ timeout: 10_000 });

  await setDashboardSearchQuery(page, "contratos");

  await expect(page.getByText("Carpeta Contratos")).toBeVisible();
  await expect(page.getByText("Carpeta Finanzas")).toHaveCount(0);
});

test("folders table shows no results state for unmatched search", async ({ page }) => {
  const userId = 9102;

  const folders = [
    buildMockFolder({ id: 803, name: "Carpeta Tributaria", colorId: 0 }),
    buildMockFolder({ id: 804, name: "Carpeta Civil", colorId: 3 }),
  ];

  await installDynamicDocumentApiMocks(page, {
    userId,
    role: "lawyer",
    hasSignature: true,
    documents: [],
    folders,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");

  await page.getByRole("button", { name: "Carpetas" }).click();
  await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible({ timeout: 15_000 });

  await setDashboardSearchQuery(page, "no-existe");

  await expect(page.getByText("No se encontraron carpetas")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Carpeta Tributaria")).toHaveCount(0);
  await expect(page.getByText("Carpeta Civil")).toHaveCount(0);
});
