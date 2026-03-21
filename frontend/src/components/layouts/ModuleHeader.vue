<template>
  <div>
    <!-- Mobile menu button -->
    <div class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 lg:hidden">
      <slot name="menu-button"></slot>
    </div>

    <!-- Hero header -->
    <div class="bg-gradient-to-r from-[#639CFF] to-[#BEB3FF] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            class="text-2xl sm:text-3xl font-bold text-white"
            data-testid="module-header-title"
          >
            {{ title }}
          </h1>
          <p v-if="subtitle" class="mt-1 text-sm text-white/80">{{ subtitle }}</p>
        </div>
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
});
</script>
