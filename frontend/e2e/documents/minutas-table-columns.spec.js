import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";
import { DOCS_MINUTAS_COLUMNS } from "../helpers/flow-tags.js";

const TAGS = [...DOCS_MINUTAS_COLUMNS, "@role:lawyer"];

test.describe("Minutas table — summary columns hidden", { tag: TAGS }, () => {
  test(
    "summary columns are absent from Minutas tab header",
    { tag: TAGS },
    async ({ page }) => {
      const userId = 8001;
      const documents = [
        buildMockDocument({
          id: 1001,
          title: "Minuta Plantilla A",
          state: "Published",
          createdBy: userId,
        }),
        buildMockDocument({
          id: 1002,
          title: "Minuta Plantilla B",
          state: "Draft",
          createdBy: userId,
        }),
      ];

      await installDynamicDocumentApiMocks(page, { userId, role: "lawyer", documents });
      await setAuthLocalStorage(page, {
        token: "e2e-token",
        userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
      });

      await page.goto("/dynamic_document_dashboard");
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "Minutas" }).click();
      await page.waitForLoadState("networkidle");

      // Confirm table rendered with data
      await expect(page.getByText("Minuta Plantilla A")).toBeVisible({ timeout: 10_000 });

      // v-if="!isLawyerMinutasContext" removes these <th> from the DOM entirely
      const table = page.getByRole("table");
      await expect(table.getByRole("columnheader", { name: "Contraparte" })).not.toBeAttached();
      await expect(table.getByRole("columnheader", { name: "Objeto" })).not.toBeAttached();
      await expect(table.getByRole("columnheader", { name: "Valor" })).not.toBeAttached();
      await expect(table.getByRole("columnheader", { name: "Plazo" })).not.toBeAttached();
      await expect(table.getByRole("columnheader", { name: "Fecha Suscripción" })).not.toBeAttached();
      await expect(table.getByRole("columnheader", { name: "Fecha Inicio" })).not.toBeAttached();
      await expect(table.getByRole("columnheader", { name: "Fecha Terminación" })).not.toBeAttached();
    }
  );
});
