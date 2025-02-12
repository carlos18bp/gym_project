<template>
  <div
    class="absolute top-1/2 left-0 right-0 z-10 transform -translate-y-1/2 flex w-full h-full px-16 justify-between items-center"
  >
    <template v-if="length > 2">
      <div class="size-8 bg-secondary rounded-full"></div>
      <div class="size-8 bg-secondary rounded-full"></div>
      <div
        :class="[
          'size-16 rounded-full',
          displayParam === 'history'
            ? 'bg-secondary'
            : 'bg-white border-2 border-secondary',
        ]"
      ></div>
    </template>

    <template v-else-if="length > 1">
      <div class="size-8 bg-secondary rounded-full"></div>
      <div
        :class="[
          'size-16 rounded-full',
          displayParam === 'history'
            ? 'bg-secondary'
            : 'bg-white border-2 border-secondary',
        ]"
      ></div>
    </template>

    <template v-else>
      <div
        class="size-16 bg-white border-2 border-secondary rounded-full"
      ></div>
    </template>
  </div>
</template>

<script setup>
const props = defineProps({
  length: {
    type: Number,
    required: true,
  },
  displayParam: {
    type: String,
    required: true,
  },
});
</script>
