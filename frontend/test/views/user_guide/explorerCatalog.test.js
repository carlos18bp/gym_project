import { createPinia, setActivePinia } from 'pinia';
import { useUserGuideStore } from '@/stores/user_guide';
import { ecosystem, findNode, flattenNodes, guideTarget, nodeAccess, nodePath, searchNodes, tourSteps } from '@/views/user_guide/explorer/catalog';

describe('explorer catalogue navigation', () => {
  test('finds accentless searches across the full ecosystem', () => {
    const results = searchNodes('reasignacion');

    expect(results.map(node => node.id)).toContain('administration-admin-data-reassignment');
  });

  test('returns an empty result for an unknown capability', () => {
    const results = searchNodes('inexistente-xyz');

    expect(results).toEqual([]);
  });

  test('builds the breadcrumb for a nested signature capability', () => {
    const path = nodePath('documents-electronic-signature');

    expect(path.map(node => node.label)).toEqual(['G&M Consultores Jurídicos', 'Trabajo jurídico', 'Archivos Jurídicos', 'Formalización y firmas']);
  });

  test('walks every capability in the selected space during a tour', () => {
    const steps = tourSteps('legal');

    expect(steps[0].id).toBe('processes');
    expect(steps.map(node => node.id)).toContain('documents-electronic-signature');
    expect(steps.every(node => nodePath(node.id)[1].id === 'legal')).toBe(true);
  });

  test('does not start a tour for a missing space', () => {
    const steps = tourSteps('missing');

    expect(steps).toEqual([]);
  });

  test('resolves every operational relationship to a sibling node', () => {
    const invalid = flattenNodes().flatMap(node => (node.relations || []).filter(relation =>
      !node.children.some(child => child.id === relation.from) || !node.children.some(child => child.id === relation.to)
    ));

    expect(invalid).toEqual([]);
    expect(new Set(flattenNodes().map(node => node.id)).size).toBe(flattenNodes().length);
  });
});

describe('explorer permissions', () => {
  test.each([
    ['administration-admin-data-reassignment', { role: 'client' }, false, false],
    ['administration-admin-data-reassignment', { role: 'client', is_staff: true }, true, true],
    ['intranet', { role: 'lawyer', is_gym_lawyer: false }, true, false],
    ['intranet', { role: 'lawyer', is_gym_lawyer: true }, true, true],
    ['organizations', { role: 'admin' }, true, false],
    ['organizations', { role: 'basic' }, false, true],
    ['secop-secop-search-filters', { role: 'basic' }, false, false],
    ['secop', { role: 'basic' }, false, true],
    ['directory', null, false, false],
  ])('evaluates access to %s for %o', (id, user, lawyerLike, allowed) => {
    const result = nodeAccess(findNode(id), user, lawyerLike);

    expect(result.allowed).toBe(allowed);
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test('keeps restricted descriptions in the global search', () => {
    const result = searchNodes('administrar servicios')[0];

    expect(result.label).toBe('Administrar Servicios');
    expect(nodeAccess(result, { role: 'basic' }, false).allowed).toBe(false);
    expect(ecosystem.children).toHaveLength(4);
  });
});

describe('explorer links to the manual', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  test('opens the existing signature section', () => {
    const guide = useUserGuideStore();
    guide.initializeGuideContent();

    expect(guideTarget(findNode('documents-electronic-signature'), guide, 'client'))
      .toEqual({ moduleId: 'documents', sectionId: 'electronic-signature' });
  });

  test('omits the administration guide for a client', () => {
    const guide = useUserGuideStore();
    guide.initializeGuideContent();

    // quality: allow-negation-only (Absence of a navigation target is the permission contract; authorized links are tested separately.)
    expect(guideTarget(findNode('administration'), guide, 'client')).toBeNull();
  });
});
