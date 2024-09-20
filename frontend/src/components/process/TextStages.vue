<template>
  <div
    class="relative mt-5 px-16 flex justify-between items-center text-gray-500 font-medium"
  >
    <template v-if="stages.length > 2">
      <p
        v-for="(stage, index) in stages.slice(-3)"
        :key="index"
        :class="['text-sm text-center', index === 2 ? 'w-16' : 'w-8']"
      >
        {{ stage.status }}
      </p>
    </template>

    <template v-else-if="stages.length > 1">
      <p
        v-for="(stage, index) in stages.slice(-2)"
        :key="index"
        :class="['text-sm text-center', index === 1 ? 'w-16' : 'w-8']"
      >
        {{ stage.status }}
      </p>
    </template>

    <template v-else>
      <p class="text-sm w-16 text-center">
        {{ stages[0].status }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { defineProps } from "vue";

const props = defineProps({
  stages: {
    type: Array,
    required: true,
  },
});
</script>
