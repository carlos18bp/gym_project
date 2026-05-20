import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

/**
 * Regression guard for R3 — the client reported that the tab card in
 * Archivos Jurídicos rendered noticeably taller than the equivalent card in
 * Procesos / SECOP / Servicios.
 *
 * Root cause: Dashboard.vue wrapped its tabs in a card that carried extra
 * `pt-4 pb-4` (lawyer) / `pt-4 pb-2` (client) padding, while the other
 * modules carried none. The fix routes every module through the shared
 * <TabsCard> wrapper (`components/layouts/TabsCard.vue`), which has NO
 * vertical padding of its own — the horizontal/vertical rhythm comes from
 * the tab buttons inside.
 *
 * This spec asserts the shared wrapper renders with zero vertical padding,
 * so the extra padding that caused the height mismatch cannot silently come
 * back. A cross-module pixel comparison was considered but rejected: it is
 * brittle (font/data dependent) and the zero-padding contract on the shared
 * wrapper is the precise, stable invariant the fix establishes.
 */

test.describe(
  "TabsCard shared wrapper",
  { tag: ["@flow:docs-dashboard-lawyer", "@module:documents", "@priority:P2", "@role:lawyer"] },
  () => {
    test(
      "Archivos Juridicos tab card renders with no extra vertical padding",
      { tag: ["@flow:docs-dashboard-lawyer", "@module:documents", "@priority:P2", "@role:lawyer"] },
      async ({ page }) => {
        const userId = 9300;

        await installDynamicDocumentApiMocks(page, {
          userId,
          role: "lawyer",
          hasSignature: false,
          documents: [
            buildMockDocument({ id: 1, title: "Minuta Base", state: "Draft", createdBy: userId }),
          ],
        });

        await setAuthLocalStorage(page, {
          token: "e2e-token",
          userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
        });

        await page.goto("/dynamic_document_dashboard");

        const tabsCard = page.getByTestId("tabs-card");
        await expect(tabsCard).toBeVisible({ timeout: 15_000 });

        const padding = await tabsCard.evaluate((el) => {
          const cs = getComputedStyle(el);
          return { top: cs.paddingTop, bottom: cs.paddingBottom };
        });

        expect(padding.top).toBe("0px");
        expect(padding.bottom).toBe("0px");
      }
    );
  }
);
