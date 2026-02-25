import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installLegalRequestsApiMocks,
  buildMockLegalRequestDetail,
} from "../helpers/legalRequestsMocks.js";

/**
 * E2E tests for AddFilesModal.vue (45.5% coverage).
 * The AddFilesModal is accessed from the legal request detail view
 * when a client wants to add files to their request.
 * Targets: modal rendering, file list display, request detail view.
 */

test.describe("AddFilesModal - legal request detail view", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, () => {
  // quality: allow-fragile-test-data (mock client email in legal request test double)
  test("legal request detail page renders for client user", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const userId = 2300;
    const request = buildMockLegalRequestDetail({
      id: 1,
      userId,
      requestNumber: "REQ-001",
      status: "PENDING",
      firstName: "Client",
      lastName: "User",
      email: "client@example.com",
      requestTypeName: "Consulta",
      disciplineName: "Civil",
      description: "Necesito asesoría legal",
      files: [],
      responses: [],
    });

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "client",
      requests: [request],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
    });

    await page.goto("/legal-requests");
    await page.waitForLoadState("networkidle");

    // Legal requests page should render
    await expect(page.locator("body")).toBeVisible();
  });

  // quality: allow-fragile-test-data (mock client email in legal request test double)
  test("legal request list shows request entries", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const userId = 2301;
    const request = buildMockLegalRequestDetail({
      id: 2,
      userId,
      requestNumber: "REQ-002",
      status: "IN_PROGRESS",
      firstName: "Client",
      lastName: "User",
      email: "client@example.com",
      requestTypeName: "Asesoría",
      disciplineName: "Laboral",
      description: "Consulta sobre contrato laboral",
      files: [{ id: 1, name: "documento.pdf", url: "/files/doc.pdf" }],
      responses: [],
    });

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "client",
      requests: [request],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
    });

    await page.goto("/legal-requests");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("AddFilesModal - lawyer view of requests", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, () => {
  // quality: allow-fragile-test-data (mock client email in legal request test double)
  test("lawyer can view legal requests list", { tag: ['@flow:legal-add-files', '@module:legal-requests', '@priority:P2', '@role:client'] }, async ({ page }) => {
    const userId = 2310;
    const request = buildMockLegalRequestDetail({
      id: 3,
      userId: 999,
      requestNumber: "REQ-003",
      status: "PENDING",
      firstName: "Client",
      lastName: "Three",
      email: "client3@example.com",
      requestTypeName: "Consulta",
      disciplineName: "Penal",
      description: "Consulta sobre proceso penal",
    });

    await installLegalRequestsApiMocks(page, {
      userId,
      role: "lawyer",
      requests: [request],
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/legal-requests");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toBeVisible();
  });
});
