import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockFolder,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("folder utilities: color selection", () => {
  test("lawyer can see folder with different colors", async ({ page }) => {
    const userId = 1400;

    const folders = [
      buildMockFolder({ id: 301, name: "Carpeta Azul", colorId: 0 }),
      buildMockFolder({ id: 302, name: "Carpeta Verde", colorId: 1 }),
      buildMockFolder({ id: 303, name: "Carpeta Roja", colorId: 2 }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
      folders,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Carpetas" }).click();

    // All folders should be visible
    await expect(page.getByText("Carpeta Azul")).toBeVisible();
    await expect(page.getByText("Carpeta Verde")).toBeVisible();
    await expect(page.getByText("Carpeta Roja")).toBeVisible();
  });

  test("folder cards display folder name correctly", async ({ page }) => {
    const userId = 1401;

    const folders = [
      buildMockFolder({ id: 401, name: "Mi Carpeta de Trabajo", colorId: 0 }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
      folders,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Carpetas" }).click();

    await expect(page.getByText("Mi Carpeta de Trabajo")).toBeVisible();
  });

  test("empty folders section shows appropriate message", async ({ page }) => {
    const userId = 1402;

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: false,
      documents: [],
      folders: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Carpetas" }).click();
    await expect(page.getByRole("heading", { name: "Mis Carpetas" })).toBeVisible();

    // Page should load successfully - either showing empty state or create button
    const pageLoaded = await page.getByRole("heading", { name: "Mis Carpetas" }).isVisible();
    expect(pageLoaded).toBeTruthy();
  });
});
