<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/auth/user';
import { useUserGuideStore } from '@/stores/user_guide';
import { guideTarget, nodeAccess } from './catalog.js';
import ExplorerIcon from './ExplorerIcon.vue';

const props = defineProps({ node: { type: Object, required: true }, preview: Boolean, touring: Boolean });
defineEmits(['select', 'start-tour', 'guide']);
const router = useRouter();
const users = useUserStore();
const guides = useUserGuideStore();
const access = computed(() => nodeAccess(props.node, users.currentUser, users.isLawyerLike));
const role = computed(() => {
  const user = users.currentUser;
  return user?.role === 'admin' || user?.is_staff || user?.is_superuser ? 'admin' : user?.role;
});
const guide = computed(() => guideTarget(props.node, guides, role.value));
const destination = computed(() => {
  const target = props.node.destination;
  if (!target || !access.value.allowed || !router.hasRoute(target.name)) return null;
  const resolved = router.resolve(target);
  if (resolved.meta.requiresLawyer && !users.isLawyerLike) return null;
  if (resolved.meta.requiresAdmin && role.value !== 'admin') return null;
  return target;
});
</script>

<template>
  <article class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" data-testid="explorer-detail">
    <div class="flex items-center gap-3">
      <ExplorerIcon :name="node.icon" class="h-10 w-10 shrink-0 rounded-xl bg-indigo-50 p-2 text-indigo-700" />
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wide text-gray-500">{{ preview ? 'Vista previa' : 'Contexto del módulo' }}</p>
        <h3 class="mt-1 break-words text-xl font-semibold text-gray-900" data-testid="explorer-detail-title">{{ node.label }}</h3>
      </div>
    </div>
    <p class="mt-4 text-sm leading-6 text-gray-600">{{ node.summary }}</p>
    <div class="mt-4 rounded-xl bg-indigo-50 p-4">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-indigo-800">¿Para qué sirve?</h4>
      <p class="mt-2 text-sm leading-6 text-indigo-950">{{ node.value }}</p>
    </div>
    <p class="mt-4 text-sm text-gray-700"><strong>Quién lo utiliza:</strong> {{ node.audience }}</p>
    <p v-if="node.kind === 'module' || node.kind === 'feature'" class="mt-2 text-sm"
      :class="access.allowed ? 'text-green-800' : 'text-amber-800'" data-testid="explorer-access">{{ access.reason }}</p>
    <div class="mt-5 flex flex-wrap gap-3">
      <RouterLink v-if="destination" :to="destination" class="explorer-button explorer-primary" data-testid="explorer-open">Abrir módulo</RouterLink>
      <button v-if="guide" type="button" class="explorer-button" data-testid="explorer-guide" @click="$emit('guide', guide)">Ver guía del módulo</button>
      <button v-if="node.kind === 'space' && !preview && !touring" type="button" class="explorer-button explorer-primary"
        data-testid="explorer-start-tour" @click="$emit('start-tour', node.id)">Iniciar recorrido</button>
    </div>
    <div v-if="node.children?.length" class="mt-6">
      <h4 class="mb-3 text-sm font-semibold text-gray-800">{{ node.kind === 'root' ? 'Espacios' : 'Explora este nivel' }}</h4>
      <div class="flex flex-wrap gap-2">
        <button v-for="child in node.children" :key="child.id" type="button" class="explorer-button text-left"
          :data-testid="`explorer-child-${child.id}`" @click="$emit('select', child.id)">{{ child.label }}</button>
      </div>
    </div>
  </article>
</template>
