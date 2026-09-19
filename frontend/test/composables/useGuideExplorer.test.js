import { defineComponent } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { useGuideExplorer } from '@/composables/useGuideExplorer';

let wrapper;
let router;
let explorer;

async function setup(query = {}) {
  const Host = defineComponent({
    setup() { explorer = useGuideExplorer(); return explorer; },
    template: '<h1>{{ node.label }}</h1>',
  });
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/user_guide', component: Host }] });
  await router.push({ path: '/user_guide', query: { view: 'explorer', ...query } });
  await router.isReady();
  wrapper = mount(Host, { global: { plugins: [router] } });
  await flushPromises();
}

afterEach(() => { wrapper?.unmount(); });

test('restores a shared node URL', async () => {
  await setup({ node: 'notifications' });

  expect(wrapper.text()).toBe('Notificaciones');
  expect(explorer.path.value.map(node => node.id)).toEqual(['ecosystem', 'collaboration', 'notifications']);
});

test('returns to the ecosystem for an unknown node', async () => {
  await setup({ node: 'does-not-exist', tour: 'legal' });

  expect(wrapper.text()).toBe('G&M Consultores Jurídicos');
  expect(router.currentRoute.value.query).toEqual({ view: 'explorer' });
});

test('recovers an incompatible tour URL', async () => {
  await setup({ node: 'notifications', tour: 'legal' });

  expect(wrapper.text()).toBe('G&M Consultores Jurídicos');
  expect(explorer.tour.value).toBeNull();
});

test('records node selection in browser history', async () => {
  await setup();
  await explorer.select('legal');
  await explorer.select('documents');
  router.back();
  await flushPromises();

  expect(wrapper.text()).toBe('Trabajo jurídico');
});

test('advances a guided tour to its next capability', async () => {
  await setup();
  await explorer.startTour('legal');
  await explorer.advanceTour(1);

  expect(router.currentRoute.value.query).toEqual({ view: 'explorer', node: 'processes-filters-search', tour: 'legal' });
  expect(explorer.stepIndex.value).toBe(1);
});

test('exits the tour when selecting another space', async () => {
  await setup();
  await explorer.startTour('legal');
  await explorer.select('account');

  expect(router.currentRoute.value.query.tour).toBeUndefined();
  expect(explorer.node.value.label).toBe('Cuenta y administración');
});

test('restores hidden relationships from the URL', async () => {
  await setup({ relations: '0' });
  await explorer.toggleRelations();

  expect(explorer.showRelations.value).toBe(true);
  expect(router.currentRoute.value.query.relations).toBeUndefined();
});
