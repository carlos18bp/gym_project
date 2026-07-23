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
 * Build the three minutas used across the tests: one created by the current
 * lawyer, one by a colleague (sharing turned off by its creator), and one by
 * a colleague with shared editing on (the backend default for new minutas).
 * All carry an informational created_by_name.
 */
function minutas() {
  return [
    {
      ...buildMockDocument({
        id: 9101,
        title: "Minuta Propia",
        state: "Draft",
        createdBy: CURRENT_LAWYER,
        allowSharedEdit: false,
      }),
      created_by_name: "Ada Lovelace",
    },
    {
      ...buildMockDocument({
        id: 9102,
        title: "Minuta De Colega",
        state: "Published",
        createdBy: COLLEAGUE_LAWYER,
        allowSharedEdit: false,
      }),
      created_by_name: "Grace Hopper",
    },
    {
      ...buildMockDocument({
        id: 9103,
        title: "Minuta Colaborativa",
        state: "Published",
        createdBy: COLLEAGUE_LAWYER,
        allowSharedEdit: true,
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

  // The column is informational, not a filter: sorting by name must keep the
  // colleague's minuta on screen with its creator still attributed.
  await page.getByRole("button", { name: "Más recientes" }).click();
  await page.getByRole("menuitem", { name: "Nombre (A-Z)" }).click();
  await expect(page.getByText("Minuta De Colega")).toBeVisible({ timeout: 10_000 });

  // Informational "Creado por" column header + the creator names.
  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader", { name: "Creado por" })).toBeVisible();
  await expect(page.getByText("Grace Hopper").first()).toBeVisible();

  // The shared-edit minuta is highlighted with a "Compartida" badge.
  await expect(table.getByText("Compartida", { exact: true })).toBeVisible();
});

test("the 'Mías' filter scopes minutas to the current lawyer", { tag: TAGS }, async ({ page }) => {
  await openMinutasTab(page);

  await expect(page.getByText("Minuta Propia")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Minuta De Colega")).toBeVisible();

  // "Mías" re-fetches with lawyer_id → only the current lawyer's minuta remains.
  await page.getByRole("button", { name: "Mías", exact: true }).click();
  await expect(page.getByText("Minuta De Colega")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText("Minuta Propia")).toBeVisible();

  // "Todas" brings the colleague's minutas back.
  await page.getByRole("button", { name: "Todas", exact: true }).click();
  await expect(page.getByText("Minuta De Colega")).toBeVisible({ timeout: 10_000 });
});

test("the 'Compartidas' filter scopes minutas to shared-edit ones", { tag: TAGS }, async ({ page }) => {
  await openMinutasTab(page);

  await expect(page.getByText("Minuta Colaborativa")).toBeVisible({ timeout: 10_000 });

  // "Compartidas" re-fetches with shared=true → only the flagged minuta remains.
  await page.getByRole("button", { name: "Compartidas", exact: true }).click();
  await expect(page.getByText("Minuta De Colega")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByText("Minuta Propia")).toHaveCount(0);
  await expect(page.getByText("Minuta Colaborativa")).toBeVisible();
});

test("a colleague's non-shared minuta only offers use actions", { tag: TAGS }, async ({ page }) => {
  await openMinutasTab(page);

  await expect(page.getByText("Minuta De Colega")).toBeVisible({ timeout: 10_000 });
  await page.getByText("Minuta De Colega").first().click();

  const modal = page.getByTestId("document-actions-modal");
  await expect(modal).toBeVisible({ timeout: 10_000 });

  await expect(modal.getByTestId("document-action-preview")).toBeVisible();
  await expect(modal.getByTestId("document-action-copy")).toBeVisible();
  await expect(modal.getByTestId("document-action-editDocument")).toHaveCount(0);
  await expect(modal.getByTestId("document-action-delete")).toHaveCount(0);
  await expect(modal.getByTestId("document-action-draft")).toHaveCount(0);
  await expect(modal.getByTestId("document-action-toggleSharedEdit")).toHaveCount(0);
});

test("a colleague's shared minuta allows editing but not delete or state change", { tag: TAGS }, async ({ page }) => {
  await openMinutasTab(page);

  await expect(page.getByText("Minuta Colaborativa")).toBeVisible({ timeout: 10_000 });
  await page.getByText("Minuta Colaborativa").first().click();

  const modal = page.getByTestId("document-actions-modal");
  await expect(modal).toBeVisible({ timeout: 10_000 });

  await expect(modal.getByTestId("document-action-editDocument")).toBeVisible();
  await expect(modal.getByTestId("document-action-copy")).toBeVisible();
  await expect(modal.getByTestId("document-action-delete")).toHaveCount(0);
  await expect(modal.getByTestId("document-action-draft")).toHaveCount(0);
  await expect(modal.getByTestId("document-action-toggleSharedEdit")).toHaveCount(0);
});

test("an own minuta keeps full management actions including the share toggle", { tag: TAGS }, async ({ page }) => {
  await openMinutasTab(page);

  await expect(page.getByText("Minuta Propia")).toBeVisible({ timeout: 10_000 });
  await page.getByText("Minuta Propia").first().click();

  const modal = page.getByTestId("document-actions-modal");
  await expect(modal).toBeVisible({ timeout: 10_000 });

  await expect(modal.getByTestId("document-action-editDocument")).toBeVisible();
  await expect(modal.getByTestId("document-action-delete")).toBeVisible();
  await expect(modal.getByTestId("document-action-toggleSharedEdit")).toBeVisible();
});
