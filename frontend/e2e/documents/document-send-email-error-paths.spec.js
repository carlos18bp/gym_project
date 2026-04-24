import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installDynamicDocumentApiMocks, buildMockDocument } from "../helpers/dynamicDocumentMocks.js";

/**
 * E2E — docs-send-email backend-failure path.
 *
 * Complements document-send-email-flow.spec.js (which covers the golden
 * path + file attach/detach + empty-email button-disabled state) by
 * asserting the FE ↔ BE contract for send-email failures:
 *   - POST send_email_with_attachments/ returning 500 surfaces the error
 *     notification from useSendEmail and the request is not retried.
 */

// quality: allow-fragile-test-data (mock recipient email in send-email test double)
test("backend 500 on send-email surfaces the error notification to the user", { tag: ['@flow:docs-send-email', '@module:documents', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 9840;
  const doc = buildMockDocument({ id: 810, title: "Doc Falla Envio", state: "Published", createdBy: userId });

  await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", hasSignature: true, documents: [doc] });

  let sendEmailCalls = 0;
  await page.route("**/api/dynamic-documents/send_email_with_attachments/", async (route) => {
    if (route.request().method() === "POST") {
      sendEmailCalls += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "SMTP server unavailable" }),
      });
      return;
    }
    await route.fallback();
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("row", { name: /Doc Falla Envio/i }).click();
  await expect(page.getByTestId("document-actions-modal")).toBeVisible({ timeout: 10_000 });

  await page.getByTestId("document-action-email").click();
  const emailInput = page.getByRole("textbox", { name: /correo electrónico/i });
  await expect(emailInput).toBeVisible({ timeout: 15_000 });

  await emailInput.fill("destinatario@example.com");

  const failedResponse = page.waitForResponse(
    (res) => res.url().includes("/dynamic-documents/send_email_with_attachments/") && res.status() === 500
  );
  await page.getByRole("button", { name: "Enviar" }).click();
  await failedResponse;

  const errorDialog = page.locator('[class~="swal2-popup"][class~="swal2-icon-error"]');
  await expect(errorDialog).toBeVisible({ timeout: 15_000 });
  await expect(errorDialog).toContainText(/error.*sending the email/i);

  expect(sendEmailCalls).toBe(1);
});
