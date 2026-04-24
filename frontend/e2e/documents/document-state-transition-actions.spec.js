import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks, buildMockDocument } from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E — docs-state-transitions action contract.
 *
 * Complements document-state-transitions.spec.js (which only asserts docs
 * appear in the right tab per state) by exercising the actual transition
 * actions in the lawyer UI and asserting the FE ↔ BE contract:
 *   - Publicar: PUT dynamic-documents/<id>/update/ with state="Published"
 *   - Mover a Borrador: PUT dynamic-documents/<id>/update/ with state="Draft"
 */

async function setupLawyer(page, { userId, docs, capturedPut }) {
  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: docs });

  await page.route("**/api/dynamic-documents/*/update/", async (route) => {
    if (route.request().method() === "PUT") {
      capturedPut.body = route.request().postDataJSON?.() || null;
      const updated = { ...capturedPut.originalDoc, ...(capturedPut.body || {}) };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(updated) });
      return;
    }
    await route.fallback();
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });
}

async function openDocActions(page, { docTitle }) {
  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  // Minutas tab is the default; the doc should be listed.
  await expect(page.getByText(docTitle)).toBeVisible({ timeout: 10_000 });
  await page.getByText(docTitle).first().click();

  await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 10_000 });
}

test("publishing a Draft document sends PUT update with state='Published'", { tag: ['@flow:docs-state-transitions', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9100;
  const draftDoc = buildMockDocument({ id: 5100, title: "Minuta Publicable", state: "Draft", createdBy: userId });
  const captured = { body: null, originalDoc: draftDoc };

  await setupLawyer(page, { userId, docs: [draftDoc], capturedPut: captured });
  await openDocActions(page, { docTitle: "Minuta Publicable" });

  const putResponse = page.waitForResponse(
    (res) => /\/api\/dynamic-documents\/5100\/update\/$/.test(res.url()) && res.request().method() === "PUT"
  );
  await page.getByTestId("document-action-publish").click();
  await putResponse;

  expect(captured.body).toMatchObject({ id: 5100, state: "Published" });
});

test("moving a Published document back to draft sends PUT update with state='Draft'", { tag: ['@flow:docs-state-transitions', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9101;
  const publishedDoc = buildMockDocument({ id: 5101, title: "Minuta Publicada Reversible", state: "Published", createdBy: userId });
  const captured = { body: null, originalDoc: publishedDoc };

  await setupLawyer(page, { userId, docs: [publishedDoc], capturedPut: captured });
  await openDocActions(page, { docTitle: "Minuta Publicada Reversible" });

  const putResponse = page.waitForResponse(
    (res) => /\/api\/dynamic-documents\/5101\/update\/$/.test(res.url()) && res.request().method() === "PUT"
  );
  await page.getByTestId("document-action-draft").click();
  await putResponse;

  expect(captured.body).toMatchObject({ id: 5101, state: "Draft" });
});
