// quality: disable fragile_test_data (emails are mock credentials used only for API route interception, not real production data)
import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installAdminReassignmentMocks } from "../helpers/adminReassignmentMocks.js";
import { ADMIN_DATA_REASSIGNMENT } from "../helpers/flow-tags.js";

const ADMIN_ID = 8300;

const LAWYERS = [
  { id: 1, first_name: "Ana", last_name: "Origen", role: "lawyer", email: "ana@example.com" },
  { id: 2, first_name: "Beto", last_name: "Destino", role: "lawyer", email: "beto@example.com" },
  { id: 3, first_name: "Cyn", last_name: "Archivada", role: "lawyer", email: "cyn@example.com", is_archived: true },
];

const SUMMARY = {
  lawyer: { id: 1, full_name: "Origen Ana", email: "ana@example.com", is_archived: false },
  processes: [
    { id: 10, ref: "P-10", plaintiff: "Actor", defendant: "Demandado", case_type: "Civil", clients_count: 1 },
  ],
  eligible_documents: [
    { id: 20, title: "Contrato de servicios", state: "Progress", assigned_to_name: null },
  ],
  ineligible_documents: [
    { id: 21, title: "Contrato firmado", state: "PendingSignatures", reason: "En proceso de firma" },
  ],
  counts: { processes: 1, eligible_documents: 1, ineligible_documents: 1 },
};

async function loginAsAdmin(page) {
  await installAdminReassignmentMocks(page, { adminId: ADMIN_ID, lawyers: LAWYERS, summary: SUMMARY });
  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: ADMIN_ID,
      role: "admin",
      first_name: "Admin",
      last_name: "E2E",
      email: "admin@example.com",
      is_profile_completed: true,
      is_staff: true,
    },
  });
}

test(
  "admin transfers processes and documents, archiving the source lawyer",
  { tag: [...ADMIN_DATA_REASSIGNMENT, "@role:admin"] },
  async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/data_reassignment");

    // Select source → preview loads
    await page.locator('[data-testid="source-lawyer-select"]').selectOption("1");
    await expect(page.locator('[data-testid="processes-card"]')).toBeVisible({ timeout: 15_000 });

    // Non-eligible document shown with its reason and no checkbox
    await expect(page.locator('[data-testid="ineligible-documents"]')).toContainText("En proceso de firma");
    await expect(page.locator('[data-testid="document-checkbox-21"]')).toHaveCount(0);

    // Select target (source excluded, archived excluded)
    await page.locator('[data-testid="target-lawyer-select"]').selectOption("2");

    // Select all + archive source
    await page.locator('[data-testid="select-all-processes"]').check();
    await page.locator('[data-testid="select-all-documents"]').check();
    await page.locator('[data-testid="archive-source-checkbox"]').check();

    await expect(page.locator('[data-testid="reassignment-summary-line"]')).toContainText(
      "1 proceso(s) y 1 documento(s)"
    );

    // Confirm modal → execute
    await page.locator('[data-testid="reassign-button"]').click();
    const confirmButton = page.getByRole("button", { name: "Confirmar" });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Success toast (SweetAlert2)
    const toast = page.locator('[class~="swal2-popup"]');
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toContainText("Se transfirieron 1 procesos y 1 documentos");
    await expect(toast).toContainText("fue archivado");
  },
);

test(
  "admin restores an archived lawyer",
  { tag: [...ADMIN_DATA_REASSIGNMENT, "@role:admin"] },
  async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/data_reassignment");

    const archivedCard = page.locator('[data-testid="archived-lawyers-card"]');
    await expect(archivedCard).toBeVisible({ timeout: 15_000 });
    await expect(archivedCard).toContainText("Archivada Cyn");

    await page.locator('[data-testid="restore-lawyer-3"]').click();

    const toast = page.locator('[class~="swal2-popup"]');
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toContainText("restaurado");
  },
);

test(
  "non-admin cannot reach the reassignment module",
  { tag: [...ADMIN_DATA_REASSIGNMENT, "@role:lawyer"] },
  async ({ page }) => {
    await installAdminReassignmentMocks(page, { adminId: 9001, role: "lawyer", lawyers: LAWYERS, summary: SUMMARY });
    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: 9001, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });
    await page.goto("/data_reassignment");

    // The admin guard redirects to the dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  },
);
