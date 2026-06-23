import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDynamicDocumentApiMocks,
  buildMockDocument,
} from "../helpers/dynamicDocumentMocks.js";

const TAGS = [
  "@flow:minutas-shared-visibility",
  "@module:documents",
  "@priority:P2",
  "@role:lawyer",
];

const CURRENT_LAWYER = 8001;
const COLLEAGUE_LAWYER = 8002;

/**
 * Build the two minutas used across the tests: one created by the current
 * lawyer and one by a colleague, both with an informational created_by_name.
 */
function minutas() {
  return [
    {
      ...buildMockDocument({
        id: 9101,
        title: "Minuta Propia",
        state: "Draft",
        createdBy: CURRENT_LAWYER,
      }),
      created_by_name: "Ada Lovelace",
    },
    {
      ...buildMockDocument({
        id: 9102,
        title: "Minuta De Colega",
        state: "Published",
        createdBy: COLLEAGUE_LAWYER,
      }),
      created_by_name: "Grace Hopper",
    },
  ];
}

async function openMinutasTab(page) {
  await installDynamicDocumentApiMocks(page, {
    userId: CURRENT_LAWYER,
    role: "lawyer",
    documents: minutas(),
  });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: CURRENT_LAWYER, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/dynamic_document_dashboard");
  await expect(page.getByRole("button", { name: "Minutas" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Minutas" }).click();
  await page.waitForLoadState("networkidle");
}

test.describe.configure({ timeout: 90_000 });

test("a lawyer sees colleague minutas with the informational 'Creado por' column", { tag: TAGS }, async ({ page }) => {
  await openMinutasTab(page);

  // Shared visibility: the colleague's minuta is listed alongside the own one.
  await expect(page.getByText("Minuta Propia")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Minuta De Colega")).toBeVisible();

  // Informational "Creado por" column header + the creator names.
  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader", { name: "Creado por" })).toBeVisible();
  await expect(page.getByText("Grace Hopper")).toBeVisible();
});

test("the 'Solo mías' filter scopes minutas to the current lawyer", { tag: TAGS }, async ({ page }) => {
  await openMinutasTab(page);

  await expect(page.getByText("Minuta Propia")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Minuta De Colega")).toBeVisible();

  // "Solo mías" re-fetches with lawyer_id → only the current lawyer's minuta remains.
  await page.getByRole("button", { name: "Solo mías" }).click();
  await expect(page.getByText("Minuta De Colega")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText("Minuta Propia")).toBeVisible();

  // "Todas" brings the colleague's minuta back.
  await page.getByRole("button", { name: "Todas" }).click();
  await expect(page.getByText("Minuta De Colega")).toBeVisible({ timeout: 10_000 });
});
