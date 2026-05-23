<template>
  <!--
    Shared card chrome for the tab navigation across modules (Archivos
    Jurídicos, Procesos, SECOP, Servicios). Only the outer card is shared:
    each module keeps its own tab markup inside the slot because the tab
    internals legitimately differ (custom dropdown vs Headless Menu vs
    <select>, badges, action buttons). Centralising the card classes here
    keeps the modules visually consistent in height — the R3 client
    feedback was that Archivos Jurídicos looked taller than the rest, caused
    by extra padding that this component removes.
  -->
  <div
    class="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 mb-6"
    :data-testid="testid"
  >
    <slot />
  </div>
</template>

<script setup>
defineProps({
  // Test hook on the card root. Defaults to ``tabs-card`` so the height
  // regression spec can measure every module; SECOP overrides it to keep
  // its existing ``secop-tabs`` selector.
  testid: { type: String, default: 'tabs-card' },
})
</script>
