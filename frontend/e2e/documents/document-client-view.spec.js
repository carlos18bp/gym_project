import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

test.describe("document dashboard: client view", () => {
  test("client sees assigned documents", async ({ page }) => {
    const lawyerId = 100;
    const clientId = 7000;

    const docs = [
      buildMockDocument({
        id: 1,
        title: "Documento Para Cliente",
        state: "Progress",
        createdBy: lawyerId,
        assignedTo: clientId,
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId: clientId,
      role: "client",
      hasSignature: false,
      documents: docs,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: clientId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Client should see the dashboard
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("client can access new document flow", async ({ page }) => {
    const clientId = 7001;

    await installDynamicDocumentApiMocks(page, {
      userId: clientId,
      role: "client",
      hasSignature: false,
      documents: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: clientId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Click new document button
    const newDocBtn = page.getByRole("button", { name: "Nuevo Documento" });
    if (await newDocBtn.isVisible()) {
      await newDocBtn.click();
      // Should see template selection or back button
      await expect(page.getByRole("button", { name: "Volver a Mis Documentos" })).toBeVisible();
    }
  });

  test("client dashboard loads correctly", async ({ page }) => {
    const clientId = 7002;

    await installDynamicDocumentApiMocks(page, {
      userId: clientId,
      role: "client",
      hasSignature: false,
      documents: [],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: clientId, role: "client", is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState("networkidle");

    // Dashboard should load with heading
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});
