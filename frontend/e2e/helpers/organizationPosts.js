import { expect } from "./test.js";

export async function closeSuccessDialog(page, expectedText) {
  const successDialog = page.getByRole("dialog");
  await expect(successDialog).toBeVisible({ timeout: 15_000 });
  await expect(successDialog).toContainText(expectedText);
  await successDialog.getByRole("button").click();
}

export function getCorporatePostCardByTitle(page, title) {
  return page.locator('[data-testid^="corporate-post-card-"]').filter({ hasText: title }).first();
}

export function getClientPostCardByTitle(page, title) {
  return page.locator('[data-testid^="client-post-card-"]').filter({ hasText: title }).first();
}

export async function openCorporatePostActions(postCard) {
  const toggleButton = postCard.locator('[data-testid^="corporate-post-actions-toggle-"]').first();
  await expect(toggleButton).toBeVisible({ timeout: 10_000 });
  await toggleButton.click();
  const actionsMenu = postCard.locator('[data-testid^="corporate-post-actions-menu-"]').first();
  await expect(actionsMenu).toBeVisible({ timeout: 10_000 });
  return actionsMenu;
}
