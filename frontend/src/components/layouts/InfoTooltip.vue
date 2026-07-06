<template>
  <div class="relative group inline-flex items-center">
    <span class="inline-flex" data-testid="info-tooltip-icon">
      <InformationCircleIcon
        :class="[iconClass, 'text-gray-400 group-hover:text-secondary cursor-help transition-colors duration-150']"
      />
    </span>
    <div
      :class="[
        'absolute z-50 hidden group-hover:block px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none w-max max-w-[16rem]',
        positionClasses
      ]"
      data-testid="info-tooltip"
      role="tooltip"
    >
      {{ text }}
    </div>
  </div>
</template>

<script setup>
// Reusable info-icon tooltip (CSS group-hover pattern shared with
// DocumentForm's variable hints). Complements the guided tour as a
// permanent quick reference next to key actions.
import { computed } from "vue";
import { InformationCircleIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
  text: {
    type: String,
    required: true,
  },
  position: {
    type: String,
    default: "top",
    validator: (value) => ["top", "bottom", "left", "right"].includes(value),
  },
  iconClass: {
    type: String,
    default: "size-5",
  },
});

const positionClasses = computed(() => {
  switch (props.position) {
    case "bottom":
      return "top-full left-1/2 -translate-x-1/2 mt-2";
    case "left":
      return "right-full top-1/2 -translate-y-1/2 mr-2";
    case "right":
      return "left-full top-1/2 -translate-y-1/2 ml-2";
    default:
      return "bottom-full left-1/2 -translate-x-1/2 mb-2";
  }
});
</script>
