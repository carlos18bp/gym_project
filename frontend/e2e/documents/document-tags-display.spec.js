import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("documents: tags display", () => {
  test("document with tags shows tag badges", async ({ page }) => {
    const userId = 9500;

    const docs = [
      buildMockDocument({
        id: 1,
        title: "Documento con Tags",
        state: "Draft",
        createdBy: userId,
        tags: [{ id: 1, name: "Urgente" }, { id: 2, name: "Revisión" }],
      }),
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
    await expect(page.getByText("Documento con Tags")).toBeVisible();
  });

  test("documents without tags display correctly", async ({ page }) => {
    const userId = 9501;

    const docs = [
      buildMockDocument({
        id: 2,
        title: "Documento sin Tags",
        state: "Draft",
        createdBy: userId,
        tags: [],
      }),
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
    await expect(page.getByText("Documento sin Tags")).toBeVisible();
  });

  test("multiple documents with different tags", async ({ page }) => {
    const userId = 9502;

    const docs = [
      buildMockDocument({
        id: 10,
        title: "Doc Tag A",
        state: "Draft",
        createdBy: userId,
        tags: [{ id: 1, name: "TagA" }],
      }),
      buildMockDocument({
        id: 11,
        title: "Doc Tag B",
        state: "Published",
        createdBy: userId,
        tags: [{ id: 2, name: "TagB" }],
      }),
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
    await expect(page.getByText("Doc Tag A")).toBeVisible();
    await expect(page.getByText("Doc Tag B")).toBeVisible();
  });
});
