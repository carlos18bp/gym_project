<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useGuideExplorer } from '@/composables/useGuideExplorer';
import { orbitalPosition, useGuideOrbit } from '@/composables/useGuideOrbit';
import { findNode, nodePath, searchNodes } from './catalog.js';
import ExplorerContext from './ExplorerContext.vue';
import ExplorerIcon from './ExplorerIcon.vue';

defineEmits(['guide']);
const { node, path, steps, stepIndex, tour, showRelations, select, back, startTour, stopTour, advanceTour, toggleRelations } = useGuideExplorer();
const container = ref(null);
const stage = ref(null);
const previewId = ref(null);
const query = ref('');
const searching = ref(false);
const { angle, zoom, compact, paused, reducedMotion, hovering, focused,
  rotate, zoomBy, reset, startDrag, moveDrag, endDrag, consumeDrag } = useGuideOrbit(container, computed(() => Boolean(tour.value)));
const children = computed(() => node.value.children || []);
const displayNode = computed(() => findNode(previewId.value) || node.value);
const results = computed(() => searchNodes(query.value));
const positions = computed(() => children.value.map((child, index) => ({
  node: child, style: orbitalPosition(index, children.value.length, angle.value, zoom.value),
})));
const relations = computed(() => node.value.relations || []);
const lines = computed(() => relations.value.map(relation => ({ ...relation,
  fromPosition: positions.value.find(position => position.node.id === relation.from)?.style,
  toPosition: positions.value.find(position => position.node.id === relation.to)?.style,
})).filter(line => line.fromPosition && line.toPosition));

watch(() => node.value.id, () => { previewId.value = null; reset(); });
async function choose(id) {
  if (consumeDrag()) return;
  query.value = '';
  searching.value = false;
  await select(id);
  await nextTick();
  stage.value?.focus();
}
function stageKey(event) {
  if (event.key === 'Escape') { event.preventDefault(); back(); }
  if (event.target !== event.currentTarget || compact.value) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); rotate(-15); }
  if (event.key === 'ArrowRight') { event.preventDefault(); rotate(15); }
}
function focusOut(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) { focused.value = false; previewId.value = null; }
}
</script>

<template>
  <section ref="container" class="guide-explorer min-w-0 space-y-5" data-testid="guide-explorer">
    <header class="rounded-2xl bg-gradient-to-br from-indigo-50 to-white p-5 ring-1 ring-indigo-100">
      <p class="text-xs font-semibold uppercase tracking-widest text-indigo-700">Conoce tu ecosistema</p>
      <h2 class="mt-2 text-2xl font-bold text-gray-900">Explorador de la plataforma</h2>
      <p class="mt-3 max-w-3xl text-sm leading-6 text-gray-600">Descubre los módulos de G&M, para qué sirven y cómo se relacionan. El mapa incluye todo el ecosistema; el acceso a cada función depende de tu cuenta.</p>
    </header>

    <div class="flex flex-wrap items-center justify-between gap-4">
      <nav aria-label="Ruta del explorador" class="flex flex-wrap items-center gap-2 text-sm">
        <template v-for="(ancestor, index) in path" :key="ancestor.id">
          <span v-if="index" aria-hidden="true" class="text-gray-400">/</span>
          <button type="button" class="rounded px-1 py-2 text-indigo-800 hover:underline focus-visible:ring-2 focus-visible:ring-indigo-500"
            :aria-current="index === path.length - 1 ? 'page' : undefined" @click="choose(ancestor.id)">{{ ancestor.label }}</button>
        </template>
      </nav>
      <div class="relative w-full max-w-md">
        <label for="explorer-search" class="sr-only">Buscar en el explorador</label>
        <input id="explorer-search" v-model="query" type="search" autocomplete="off" placeholder="Buscar módulo, función o beneficio…"
          class="w-full rounded-xl border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          @focus="searching = true" @input="searching = true" @keydown.esc="searching = false"
          @keydown.down.prevent="$refs.searchResults?.querySelector('button')?.focus()" />
        <div v-if="searching && query.trim()" ref="searchResults" class="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg"
          data-testid="explorer-search-results" @keydown.esc="searching = false">
          <button v-for="result in results" :key="result.id" type="button" class="block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-indigo-50 focus:bg-indigo-50"
            :data-testid="`explorer-result-${result.id}`" @click="choose(result.id)">
            <span class="block text-sm font-semibold text-gray-900">{{ result.label }}</span>
            <span class="mt-1 block text-xs text-gray-500">{{ nodePath(result.id).slice(1).map(item => item.label).join(' / ') }}</span>
          </button>
          <p v-if="!results.length" class="px-4 py-5 text-sm text-gray-600" role="status">No encontramos un módulo con ese término.</p>
        </div>
      </div>
    </div>

    <div v-if="tour" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4" data-testid="explorer-tour">
      <p class="text-sm text-indigo-950">Recorrido: {{ tour.label }} · Paso {{ stepIndex + 1 }} de {{ steps.length }}</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="explorer-button" :disabled="stepIndex === 0" @click="advanceTour(-1)">Anterior</button>
        <button v-if="stepIndex < steps.length - 1" type="button" class="explorer-button explorer-primary" @click="advanceTour(1)">Siguiente</button>
        <button v-else type="button" class="explorer-button explorer-primary" @click="stopTour">Finalizar recorrido</button>
        <button type="button" class="explorer-button" @click="stopTour">Salir del recorrido</button>
      </div>
    </div>

    <div class="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button v-if="path.length > 1" type="button" class="explorer-button" data-testid="explorer-back" @click="back">Volver al nivel anterior</button>
        <p class="text-xs text-gray-600">{{ compact ? 'Selecciona una tarjeta para explorar' : 'Arrastra el fondo para girar · Tab recorre los módulos' }}</p>
        <div v-if="!compact" class="flex flex-wrap gap-2" aria-label="Controles de la órbita">
          <button type="button" class="explorer-button" aria-label="Girar a la izquierda" @click="rotate(-15)">↶</button>
          <button type="button" class="explorer-button" aria-label="Girar a la derecha" @click="rotate(15)">↷</button>
          <button type="button" class="explorer-button" aria-label="Alejar" @click="zoomBy(-0.04)">−</button>
          <button type="button" class="explorer-button" aria-label="Acercar" @click="zoomBy(0.04)">+</button>
          <button type="button" class="explorer-button" @click="reset">Centrar</button>
          <button v-if="!tour && !reducedMotion" type="button" class="explorer-button" :aria-pressed="paused" @click="paused = !paused">{{ paused ? 'Reanudar giro' : 'Pausar giro' }}</button>
        </div>
        <button v-if="relations.length" type="button" class="explorer-button" :aria-pressed="showRelations" @click="toggleRelations">{{ showRelations ? 'Ocultar relaciones' : 'Mostrar relaciones' }}</button>
      </div>

      <div class="grid gap-5" :class="compact ? '' : 'grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]'">
        <div ref="stage" tabindex="0" :data-layout="compact ? 'cards' : 'orbit'" data-testid="explorer-stage"
          :aria-label="`${node.label}: módulos disponibles`"
          :class="compact ? 'grid content-start gap-3 sm:grid-cols-2' : 'relative min-h-[44rem] touch-none overflow-hidden rounded-2xl border border-indigo-100 bg-white'"
          class="outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          @keydown="stageKey" @pointerdown.self="!compact && startDrag($event)" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag"
          @click.self="consumeDrag"
          @mouseenter="hovering = true" @mouseleave="hovering = false; previewId = null" @focusin="focused = true" @focusout="focusOut">
          <template v-if="!compact">
            <div class="pointer-events-none absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-indigo-100" aria-hidden="true" />
            <svg class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <line v-for="position in positions" :key="position.node.id" x1="50%" y1="50%" :x2="position.style.left" :y2="position.style.top" stroke="#c7d2fe" />
              <template v-if="showRelations">
                <line v-for="line in lines" :key="line.from + line.to" :x1="line.fromPosition.left" :y1="line.fromPosition.top" :x2="line.toPosition.left" :y2="line.toPosition.top" stroke="#6366f1" stroke-dasharray="5 4" />
              </template>
            </svg>
            <div class="pointer-events-none absolute left-1/2 top-1/2 flex w-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-3xl border border-indigo-200 bg-white p-5 text-center shadow-sm">
              <ExplorerIcon :name="node.icon" class="mb-3 h-9 w-9 text-indigo-600" />
              <p class="text-xs text-gray-500">{{ node.kind === 'root' ? 'Ecosistema' : 'Estás explorando' }}</p>
              <h3 class="mt-2 font-semibold text-gray-900">{{ node.label }}</h3>
              <p class="mt-3 text-xs text-indigo-700">{{ children.length }} elementos</p>
            </div>
          </template>
          <button v-for="position in positions" :key="position.node.id" type="button"
            :data-testid="`explorer-node-${position.node.id}`" :style="compact ? undefined : position.style"
            :class="compact ? 'flex min-h-28 items-center gap-3 p-4 text-left' : 'absolute z-10 flex min-h-24 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 p-3 text-center'"
            class="rounded-2xl border border-gray-200 bg-white text-sm shadow-sm hover:border-indigo-400 hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-500"
            @mouseenter="!compact && (previewId = position.node.id)" @mouseleave="previewId = null" @focus="!compact && (previewId = position.node.id)" @blur="previewId = null" @click="choose(position.node.id)">
            <ExplorerIcon :name="position.node.icon" class="h-6 w-6 shrink-0 text-indigo-600" />
            <span class="break-words font-semibold text-gray-800">{{ position.node.label }}</span>
          </button>
          <p v-if="compact && !children.length" class="text-sm text-gray-600 sm:col-span-2">Llegaste a una función. Consulta su explicación o vuelve al nivel anterior.</p>
        </div>
        <ExplorerContext :node="displayNode" :preview="displayNode.id !== node.id" :touring="Boolean(tour)" class="self-start"
          @select="choose" @start-tour="startTour" @guide="$emit('guide', $event)" />
      </div>
    </div>

    <div v-if="showRelations && relations.length" class="rounded-xl border border-gray-200 p-5" data-testid="explorer-relations">
      <h3 class="font-semibold text-gray-900">Conexiones entre módulos</h3>
      <p class="mt-1 text-xs text-gray-500">Línea continua: jerarquía · Línea discontinua: relación operativa</p>
      <ul class="mt-3 space-y-3 text-sm text-gray-600">
        <li v-for="relation in relations" :key="relation.from + relation.to">
          <button type="button" class="text-indigo-800 underline" @click="choose(relation.from)">{{ findNode(relation.from).label }}</button>
          — {{ relation.label }} —
          <button type="button" class="text-indigo-800 underline" @click="choose(relation.to)">{{ findNode(relation.to).label }}</button>
        </li>
      </ul>
    </div>
    <p v-if="reducedMotion" class="text-xs text-gray-500">El giro automático está desactivado por tu preferencia de movimiento reducido.</p>
    <p class="sr-only" role="status" aria-live="polite">{{ node.label }}. {{ children.length }} elementos para explorar.</p>
  </section>
</template>

<style>
.guide-explorer .explorer-button {
  @apply inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed;
}
.guide-explorer .explorer-primary {
  @apply border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-800;
}
</style>
