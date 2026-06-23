<template>
  <div class="w-full">
    <!-- Optional "O continuar con" divider -->
    <div v-if="showDivider" class="flex items-center w-full mb-4">
      <div class="flex-grow border-t border-gray-300"></div>
      <span class="mx-4 text-gray-500">O continuar con</span>
      <div class="flex-grow border-t border-gray-300"></div>
    </div>

    <!--
      Social providers share the same size (40px height, 240px width) and lay out
      horizontally side by side on >= sm, stacking vertically (same width) on
      small screens. The Google button is the official GSI button (sized via
      buttonConfig); the Microsoft button is a custom button matched to it.
    -->
    <div class="w-full flex flex-col sm:flex-row sm:justify-center items-center gap-3">
      <GoogleLogin
        :buttonConfig="{ size: 'large', width: '240' }"
        :callback="onGoogle"
        select-account
        :auto-login="false"
      />
      <OutlookLoginButton class="sm:w-[240px]" @click="emit('outlook')" />
    </div>
  </div>
</template>

<script setup>
import OutlookLoginButton from "@/components/auth/OutlookLoginButton.vue";

defineProps({
  // Whether to render the "O continuar con" separator above the buttons.
  showDivider: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["google", "outlook"]);

// Forward the Google credential response to the parent unchanged.
const onGoogle = (response) => emit("google", response);
</script>
