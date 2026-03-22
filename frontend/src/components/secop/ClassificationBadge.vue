<template>
  <span
    :class="['inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold', badgeClass]"
    :data-testid="`classification-badge-${status}`"
  >
    <component :is="icon" class="h-3.5 w-3.5" />
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from "vue";
import { StarIcon, EyeIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/vue/20/solid";

const props = defineProps({
  status: {
    type: String,
    required: true,
  },
});

const badgeClass = computed(() => {
  const classes = {
    INTERESTING: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
    UNDER_REVIEW: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    DISCARDED: "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/20",
    APPLIED: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20",
  };
  return classes[props.status] || "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/20";
});

const icon = computed(() => {
  const icons = {
    INTERESTING: StarIcon,
    UNDER_REVIEW: EyeIcon,
    APPLIED: CheckCircleIcon,
    DISCARDED: XCircleIcon,
  };
  return icons[props.status] || XCircleIcon;
});

const label = computed(() => {
  const labels = {
    INTERESTING: "Interesante",
    UNDER_REVIEW: "En Revisión",
    DISCARDED: "Descartado",
    APPLIED: "Aplicado",
  };
  return labels[props.status] || props.status;
});
</script>
