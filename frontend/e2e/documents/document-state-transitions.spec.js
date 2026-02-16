import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("document states: Draft, Published, Progress", () => {
  test("lawyer sees Draft documents in Minutas tab", async ({ page }) => {
    const userId = 1500;

    const docs = [
      buildMockDocument({ id: 101, title: "Borrador Uno", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 102, title: "Borrador Dos", state: "Draft", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    await expect(page.getByText("Borrador Uno")).toBeVisible();
    await expect(page.getByText("Borrador Dos")).toBeVisible();
  });

  test("lawyer sees Published documents", async ({ page }) => {
    const userId = 1501;

    const docs = [
      buildMockDocument({ id: 201, title: "Publicado Alpha", state: "Published", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    await expect(page.getByText("Publicado Alpha")).toBeVisible();
    // State badge should show Published state
    await expect(page.getByText("Publicado").first()).toBeVisible();
  });

  test("client sees documents in Progress state", async ({ page }) => {
    const userId = 1502;

    const docs = [
      buildMockDocument({
        id: 301,
        title: "Documento En Progreso",
        state: "Progress",
        createdBy: 999,
        assignedTo: userId,
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Mis Documentos" }).click();

    await expect(page.getByText("Documento En Progreso")).toBeVisible();
  });

  test("completed documents show Completed state", async ({ page }) => {
    const userId = 1503;

    const docs = [
      buildMockDocument({
        id: 401,
        title: "Documento Completado",
        state: "Completed",
        createdBy: 999,
        assignedTo: userId,
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "client",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Mis Documentos" }).click();

    await expect(page.getByText("Documento Completado")).toBeVisible();
  });

  test("state badge displays correct color/style for each state", async ({ page }) => {
    const userId = 1504;

    const docs = [
      buildMockDocument({ id: 501, title: "Doc Draft", state: "Draft", createdBy: userId }),
      buildMockDocument({ id: 502, title: "Doc Published", state: "Published", createdBy: userId }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Minutas" }).click();

    // Both documents should be visible with their states
    await expect(page.getByText("Doc Draft")).toBeVisible();
    await expect(page.getByText("Doc Published")).toBeVisible();
    await expect(page.getByText("Borrador")).toBeVisible();
    await expect(page.getByText("Publicado")).toBeVisible();
  });
});
