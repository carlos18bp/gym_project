<template>
  <transition @enter="fadeIn" @leave="fadeOut">
    <div
      v-if="$slots.default"
      class="fixed inset-0 z-[9999] bg-gray-400 bg-opacity-40 backdrop-blur-md flex items-center justify-center"
    >
      <slot />
    </div>
  </transition>
</template>

<script setup>
import { fadeInModal, fadeOutModal } from "@/animations/modalInOut";

// Function to handle the fade-in animation
// - `el`: The HTML element to apply the animation on
// - `done`: Callback function to indicate that the animation is complete
function fadeIn(el, done) {
  fadeInModal(el); // Apply the fade-in animation defined in `modalInOut.js`
  done(); // Call the `done` callback to signal completion
}

// Function to handle the fade-out animation
// - `el`: The HTML element to apply the animation on
// - `done`: Callback function to indicate that the animation is complete
function fadeOut(el, done) {
  fadeOutModal(el, done); // Apply the fade-out animation defined in `modalInOut.js`
  done(); // Call the `done` callback to signal completion
}
</script>
