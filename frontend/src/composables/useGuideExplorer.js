import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ecosystem, findNode, nodePath, tourSteps } from '@/views/user_guide/explorer/catalog.js';

export function useGuideExplorer() {
  const router = useRouter();
  const query = computed(() => router.currentRoute.value.query || {});
  const node = computed(() => findNode(query.value.node) || ecosystem);
  const path = computed(() => nodePath(node.value.id));
  const steps = computed(() => tourSteps(query.value.tour));
  const stepIndex = computed(() => steps.value.findIndex(step => step.id === node.value.id));
  const tour = computed(() => stepIndex.value >= 0 ? findNode(query.value.tour) : null);
  const showRelations = computed(() => query.value.relations !== '0');

  function navigate(nodeId, tourId = tour.value?.id, replace = false) {
    const next = { ...query.value, view: 'explorer' };
    delete next.node;
    delete next.tour;
    if (nodeId && nodeId !== ecosystem.id && findNode(nodeId)) next.node = nodeId;
    if (tourSteps(tourId).some(step => step.id === nodeId)) next.tour = tourId;
    return router[replace ? 'replace' : 'push']({ query: next });
  }

  const select = id => navigate(id);
  const back = () => navigate(path.value.at(-2)?.id);
  const startTour = id => navigate(tourSteps(id)[0]?.id, id);
  const stopTour = () => navigate(node.value.id, null);
  const advanceTour = offset => {
    const next = steps.value[stepIndex.value + offset];
    if (next) return navigate(next.id);
  };
  const toggleRelations = () => {
    const next = { ...query.value };
    if (showRelations.value) next.relations = '0';
    else delete next.relations;
    return router.push({ query: next });
  };

  watch(query, current => {
    if (current.view !== 'explorer') return;
    const invalidNode = current.node !== undefined && !findNode(current.node);
    const invalidTour = current.tour !== undefined && !tour.value;
    if (invalidNode || invalidTour) navigate(null, null, true);
  }, { immediate: true });

  return { node, path, steps, stepIndex, tour, showRelations, select, back, startTour, stopTour, advanceTour, toggleRelations };
}
