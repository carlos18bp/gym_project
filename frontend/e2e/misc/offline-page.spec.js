import { test, expect } from "../helpers/test.js";

/**
 * E2E for the offline / no-connection page (views/offline/NoConnection.vue at
 * /no_connection). Public route — no auth or API mocks required. Closes the
 * previously-uncovered misc-offline flow (the only route with no coverage at
 * any layer).
 */

test.describe(
  "Offline page",
  { tag: ["@flow:misc-offline", "@module:misc", "@priority:P4", "@role:shared"] },
  () => {
    test(
      "no_connection route shows the offline message",
      { tag: ["@flow:misc-offline", "@module:misc", "@priority:P4", "@role:shared"] },
      async ({ page }) => {
        await page.goto("/no_connection");

        await expect(
          page.getByRole("heading", { name: "¡Parece que no hay internet!" })
        ).toBeVisible();
      }
    );

    test(
      "no_connection route shows guidance to check the connection",
      { tag: ["@flow:misc-offline", "@module:misc", "@priority:P4", "@role:shared"] },
      async ({ page }) => {
        await page.goto("/no_connection");

        await expect(
          page.getByText("Revisa tu conexión para seguir navegando.")
        ).toBeVisible();
      }
    );
  }
);
