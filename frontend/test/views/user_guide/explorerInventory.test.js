import fs from 'node:fs';
import path from 'node:path';
import { createPinia, setActivePinia } from 'pinia';
import { findNode, flattenNodes } from '@/views/user_guide/explorer/catalog';
import { routeInventory, nonScreenRoutes } from '@/views/user_guide/explorer/routeInventory';
import { useUserGuideStore } from '@/stores/user_guide';

const source = fs.readFileSync(path.resolve(__dirname, '../../../src/router/index.js'), 'utf8');
const routePaths = [...source.matchAll(/\bpath:\s*["']([^"']*)["']/g)].map(match => match[1]);

test('every router screen has an explorer explanation', () => {
  const unmapped = routePaths.filter(route => !routeInventory[route] && !nonScreenRoutes[route]);

  expect(unmapped).toEqual([]);
  expect(routePaths).toContain('/data_reassignment');
});

test('every inventory entry resolves to an existing capability', () => {
  const stale = Object.entries(routeInventory).filter(([route, id]) => !routePaths.includes(route) || !findNode(id));

  expect(stale).toEqual([]);
  expect(findNode(routeInventory['/notifications']).label).toBe('Notificaciones');
});

test('manual references resolve to existing sections', () => {
  setActivePinia(createPinia());
  const guides = useUserGuideStore();
  guides.initializeGuideContent();
  const missing = flattenNodes().filter(node => node.guide).filter(node => {
    const [moduleId, sectionId] = node.guide;
    const content = guides.guideContent[moduleId];
    return !content || (sectionId && !content.sections.some(section => section.id === sectionId));
  });

  expect(missing.map(node => node.id)).toEqual([]);
  expect(guides.guideContent.documents.sections.length).toBeGreaterThan(0);
});
