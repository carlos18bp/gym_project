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
        // audit: load-only flow (NoConnection.vue is a terminal status screen: it
        // renders no control at all and no view links to /no_connection, so there
        // is no user action to drive)
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
        // audit: load-only flow (NoConnection.vue is a terminal status screen: it
        // renders no control at all and no view links to /no_connection, so there
        // is no user action to drive)
        await page.goto("/no_connection");

        await expect(
          page.getByText("Revisa tu conexión para seguir navegando.")
        ).toBeVisible();
      }
    );
  }
);
