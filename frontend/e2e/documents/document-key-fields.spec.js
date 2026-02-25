import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks, buildMockDocument } from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E tests for docs-key-fields flow.
 * Covers: marking variables as key fields for document classification.
 */

test("lawyer sees document with key field variables on dashboard", { tag: ['@flow:docs-key-fields', '@module:documents', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8840;
  const docs = [
    buildMockDocument({
      id: 8101, title: "Contrato Con Campos Clave", state: "Published",
      createdBy: userId,
      variables: [
        { name: "nombre_cliente", type: "text", is_key: true, value: "Juan García" },
        { name: "monto", type: "number", is_key: true, value: "5000000" },
        { name: "notas", type: "text", is_key: false, value: "" },
      ],
    }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByText("Contrato Con Campos Clave")).toBeVisible({ timeout: 15_000 });
});

test("lawyer sees document without key fields", { tag: ['@flow:docs-key-fields', '@module:documents', '@priority:P3', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8841;
  const docs = [
    buildMockDocument({
      id: 8110, title: "Contrato Sin Campos Clave", state: "Published",
      createdBy: userId,
      variables: [
        { name: "observaciones", type: "text", is_key: false, value: "" },
      ],
    }),
  ];

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByText("Contrato Sin Campos Clave")).toBeVisible({ timeout: 15_000 });
});
