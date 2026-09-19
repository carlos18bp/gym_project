import { test, expect } from '../helpers/test.js';
import { openExplorerGuide } from '../helpers/guideExplorer.js';

test('phone users explore with cards', { tag: ['@flow:user-guide-explorer-responsive', '@outcome:success'] }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openExplorerGuide(page);
  await page.getByTestId('explorer-node-collaboration').click();
  await page.getByTestId('explorer-node-notifications').click();

  await expect(page.getByTestId('explorer-stage')).toHaveAttribute('data-layout', 'cards');
  await expect(page.getByTestId('explorer-detail-title')).toHaveText('Notificaciones');
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
});

test('tablet users can return to the previous level', { tag: ['@flow:user-guide-explorer-responsive', '@outcome:success'] }, async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await openExplorerGuide(page);
  await page.getByTestId('explorer-node-account').click();
  await page.getByTestId('explorer-back').click();

  await expect(page.getByTestId('explorer-stage').getByRole('button')).toHaveCount(4);
  await expect(page.getByTestId('explorer-stage')).toHaveAttribute('data-layout', 'cards');
});

test('desktop users rotate the orbital explorer', { tag: ['@flow:user-guide-explorer-orbit', '@outcome:success'] }, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openExplorerGuide(page);
  const node = page.getByTestId('explorer-node-legal');
  const before = await node.boundingBox();
  await page.getByRole('button', { name: 'Girar a la derecha' }).click();

  await expect(page.getByTestId('explorer-stage')).toHaveAttribute('data-layout', 'orbit');
  await expect.poll(async () => (await node.boundingBox()).x).toBeGreaterThan(before.x + 5);
});

test('keyboard users return with Escape', { tag: ['@flow:user-guide-explorer-responsive', '@outcome:success'] }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openExplorerGuide(page);
  await page.getByTestId('explorer-node-legal').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');

  await expect(page.getByTestId('explorer-detail-title')).toHaveText('G&M Consultores Jurídicos');
  await expect(page.getByText('El giro automático está desactivado por tu preferencia de movimiento reducido.')).toBeVisible();
});
