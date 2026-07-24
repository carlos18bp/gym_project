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
    <Transition
      enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isHovered"
        :class="[
          'absolute z-50 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none w-max max-w-[16rem]',
          positionClasses,
          originClass
        ]"
        data-testid="info-tooltip"
        role="tooltip"
      >
        {{ text }}
        <span
          :class="['absolute border-4 border-transparent', arrowClasses]"
          data-testid="info-tooltip-arrow"
          aria-hidden="true"
        ></span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
// Reusable info-icon tooltip. The bubble is v-if-gated (not CSS-hidden)
// so its text never sits in the DOM until hover — hidden tooltip copy
// would otherwise collide with text-based selectors in the E2E suite.
import { computed, ref } from "vue";
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

const isHovered = ref(false);

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

// The scale transition grows the bubble out from the icon's side
const originClass = computed(() => {
  switch (props.position) {
    case "bottom":
      return "origin-top";
    case "left":
      return "origin-right";
    case "right":
      return "origin-left";
    default:
      return "origin-bottom";
  }
});

// Little pointer triangle (border trick, same pattern as the
// basic-user restriction tooltip in the dashboard action bars)
const arrowClasses = computed(() => {
  switch (props.position) {
    case "bottom":
      return "bottom-full left-1/2 -translate-x-1/2 border-b-gray-900";
    case "left":
      return "left-full top-1/2 -translate-y-1/2 border-l-gray-900";
    case "right":
      return "right-full top-1/2 -translate-y-1/2 border-r-gray-900";
    default:
      return "top-full left-1/2 -translate-x-1/2 border-t-gray-900";
  }
});
</script>
