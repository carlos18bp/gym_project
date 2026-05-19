// quality: disable fragile_test_data (emails are mock credentials used only for API route interception, not real production data)
import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import { LEGAL_FILES_TABLE_PULSE } from "../helpers/flow-tags.js";

/**
 * E2E for legal-files-table-pulse (Req #6).
 *
 * Verifies that pending-signature rows in SignaturesListTable show
 * the animate-pulse class for ~8 seconds after mount, then stop.
 */

test(
  "pending-signature rows pulse on mount and stop after ~8 seconds",
  { tag: [...LEGAL_FILES_TABLE_PULSE, "@role:lawyer"] },
  async ({ page }) => {
    const userId = 9201;
    const docs = [
      buildMockDocument({
        id: 6001,
        title: "Doc Pulsante 1",
        state: "PendingSignatures",
        createdBy: userId,
        requires_signature: true,
        signatures: [
          {
            id: 60010,
            signer_id: userId,
            signer_email: "e2e@example.com",
            signed: false,
            signer_name: "E2E Lawyer",
          },
        ],
      }),
      buildMockDocument({
        id: 6002,
        title: "Doc Pulsante 2",
        state: "PendingSignatures",
        createdBy: userId,
        requires_signature: true,
        signatures: [
          {
            id: 60020,
            signer_id: userId,
            signer_email: "e2e@example.com",
            signed: false,
            signer_name: "E2E Lawyer",
          },
        ],
      }),
    ];

    await installDynamicDocumentApiMocks(page, {
      userId,
      role: "lawyer",
      hasSignature: true,
      pendingSignaturesCount: 2,
      documents: docs,
    });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: userId,
        role: "lawyer",
        is_gym_lawyer: true,
        is_profile_completed: true,
      },
    });

    await page.goto("/dynamic_document_dashboard?lawyerTab=pending-signatures");

    const row = page.getByTestId("signatures-list-row-6001");
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toHaveClass(/animate-pulse/);

    await expect(row).not.toHaveClass(/animate-pulse/, { timeout: 12_000 });
  }
);
