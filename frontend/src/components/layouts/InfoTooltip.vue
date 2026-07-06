<template>
  <div
    class="relative inline-flex items-center"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @focusin="isHovered = true"
    @focusout="isHovered = false"
  >
    <span class="inline-flex" data-testid="info-tooltip-icon">
      <InformationCircleIcon
        :class="[iconClass, isHovered ? 'text-secondary' : 'text-gray-400', 'cursor-help transition-colors duration-150']"
      />
    </span>
    <div
      v-if="isHovered"
      :class="[
        'absolute z-50 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none w-max max-w-[16rem]',
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
// Reusable info-icon tooltip. The bubble is v-if-gated (not CSS-hidden)
// so its text never sits in the DOM until hover — hidden tooltip copy
// would otherwise collide with text-based selectors in the E2E suite.
import { computed, ref } from "vue";
import { InformationCircleIcon } from "@heroicons/vue/24/outline";

const isHovered = ref(false);

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
