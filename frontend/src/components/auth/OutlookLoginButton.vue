<template>
  <button
    type="button"
    :disabled="disabled"
    data-testid="outlook-login-button"
    class="flex items-center justify-center gap-3 w-full max-w-[240px] h-[40px] px-4 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    @click="$emit('click')"
  >
    <svg
      width="18"
      height="18"
      viewBox="0 0 23 23"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
    <span>Continuar con Microsoft</span>
  </button>
</template>

<script setup>
defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["click"]);
</script>
