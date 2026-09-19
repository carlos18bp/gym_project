import { test, expect } from '../helpers/test.js';
import { openExplorerGuide } from '../helpers/guideExplorer.js';

test('client explores the complete ecosystem from the manual', { tag: ['@flow:user-guide-explorer-navigation', '@outcome:display'] }, async ({ page }) => {
  await openExplorerGuide(page);
  await page.getByTestId('explorer-node-account').click();

  await expect(page.getByTestId('explorer-stage').getByRole('button')).toHaveText([
    'Autenticación y Cuenta', 'Suscripciones y Pagos', 'Administración del Sistema', 'Ayuda y políticas',
  ]);
});

test('breadcrumb returns to the ecosystem', { tag: ['@flow:user-guide-explorer-navigation', '@outcome:success'] }, async ({ page }) => {
  await openExplorerGuide(page);
  await page.getByTestId('explorer-node-legal').click();
  await page.getByTestId('explorer-node-documents').click();
  await page.getByRole('navigation', { name: 'Ruta del explorador' }).getByRole('button', { name: 'G&M Consultores Jurídicos' }).click();

  await expect(page.getByTestId('explorer-stage').getByRole('button')).toHaveCount(4);
  await expect(page).not.toHaveURL(/node=/);
});

test('search finds a nested capability without accents', { tag: ['@flow:user-guide-explorer-search', '@outcome:success'] }, async ({ page }) => {
  await openExplorerGuide(page);
  await page.getByLabel('Buscar en el explorador').fill('reasignacion');
  await page.getByTestId('explorer-result-administration-admin-data-reassignment').click();

  await expect(page.getByTestId('explorer-detail-title')).toHaveText('Reasignación de Datos');
  await expect(page).toHaveURL(/node=administration-admin-data-reassignment/);
});

test('search explains when no capability matches', { tag: ['@flow:user-guide-explorer-search', '@outcome:display'] }, async ({ page }) => {
  await openExplorerGuide(page);
  await page.getByLabel('Buscar en el explorador').fill('inexistente-xyz');

  await expect(page.getByTestId('explorer-search-results')).toHaveText('No encontramos un módulo con ese término.');
});

test('client sees the restricted administrative capability', { tag: ['@flow:user-guide-explorer-access', '@outcome:error'] }, async ({ page }) => {
  await openExplorerGuide(page);
  await page.getByTestId('explorer-node-account').click();
  await page.getByTestId('explorer-node-administration').click();
  await page.getByTestId('explorer-node-administration-admin-data-reassignment').click();

  await expect(page.getByTestId('explorer-access')).toHaveText('Requiere: Administración');
  await expect(page.getByTestId('explorer-open')).toHaveCount(0);
  await expect(page.getByTestId('explorer-guide')).toHaveCount(0);
});

test('staff can open the administrative destination', { tag: ['@flow:user-guide-explorer-access', '@outcome:success'] }, async ({ page }) => {
  await openExplorerGuide(page, { role: 'client', is_staff: true });
  await page.getByLabel('Buscar en el explorador').fill('Administrar Servicios');
  await page.getByTestId('explorer-result-administration-admin-services-catalog').click();
  await page.getByTestId('explorer-open').click();

  await expect(page).toHaveURL(/\/services_admin$/);
  await expect(page.getByRole('heading', { name: 'Administrar Servicios', exact: true })).toBeVisible();
});

test('a guided tour advances to a capability', { tag: ['@flow:user-guide-explorer-tour', '@outcome:success'] }, async ({ page }) => {
  await openExplorerGuide(page);
  await page.getByTestId('explorer-node-legal').click();
  await page.getByTestId('explorer-start-tour').click();
  await page.getByTestId('explorer-tour').getByRole('button', { name: 'Siguiente', exact: true }).click();

  await expect(page.getByTestId('explorer-detail-title')).toHaveText('Consulta y búsqueda');
  await expect(page.getByTestId('explorer-tour')).toContainText('Paso 2 de');
});

test('stopping a tour preserves the selected capability', { tag: ['@flow:user-guide-explorer-tour', '@outcome:success'] }, async ({ page }) => {
  await openExplorerGuide(page);
  await page.getByTestId('explorer-node-legal').click();
  await page.getByTestId('explorer-start-tour').click();
  await page.getByRole('button', { name: 'Salir del recorrido' }).click();

  await expect(page.getByTestId('explorer-detail-title')).toHaveText('Procesos');
  await expect(page.getByTestId('explorer-tour')).toHaveCount(0);
  await expect(page).not.toHaveURL(/tour=/);
});

test('browser back restores the selected module', { tag: ['@flow:user-guide-explorer-navigation', '@outcome:success'] }, async ({ page }) => {
  await openExplorerGuide(page);
  await page.getByTestId('explorer-node-legal').click();
  await page.getByTestId('explorer-node-documents').click();
  await page.goBack();

  await expect(page.getByTestId('explorer-detail-title')).toHaveText('Trabajo jurídico');
});

test('reload restores the shared explorer URL', { tag: ['@flow:user-guide-explorer-navigation', '@outcome:success'] }, async ({ page }) => {
  await openExplorerGuide(page);
  await page.getByTestId('explorer-node-legal').click();
  await page.getByTestId('explorer-node-documents').click();
  await page.reload();

  await expect(page.getByTestId('explorer-detail-title')).toHaveText('Archivos Jurídicos');
});

test('the explorer links to the existing document guide', { tag: ['@flow:user-guide-explorer-navigation', '@outcome:success'] }, async ({ page }) => {
  await openExplorerGuide(page);
  await page.getByTestId('explorer-node-legal').click();
  await page.getByTestId('explorer-node-documents').click();
  await page.getByTestId('explorer-guide').click();

  await expect(page.getByRole('heading', { name: 'Archivos Jurídicos', exact: true })).toBeVisible();
  await expect(page.getByTestId('guide-explorer')).toHaveCount(0);
});

test('the relationship toggle updates the URL', { tag: ['@flow:user-guide-explorer-relations', '@outcome:success'] }, async ({ page }) => {
  await openExplorerGuide(page);
  await page.getByRole('button', { name: 'Ocultar relaciones' }).click();

  await expect(page.getByTestId('explorer-relations')).toHaveCount(0);
  await expect(page).toHaveURL(/relations=0/);
});
