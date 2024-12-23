<template>
  <!-- Using the SearchBarAndFilterBy component -->
  <SearchBarAndFilterBy @update:searchQuery="searchQuery = $event">
    <slot></slot>
  </SearchBarAndFilterBy>
  <!-- Calendly inline widget begin -->
  <div class="calendly-inline-widget" style="min-width: 320px; height: 1200px;" data-url="https://calendly.com/infogym/cita-abogado"></div>
  <!-- Calendly inline widget end -->  
</template>

<script setup>
import { onMounted } from "vue";
import SearchBarAndFilterBy from "@/components/layouts/SearchBarAndFilterBy.vue";

onMounted(() => {
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://assets.calendly.com/assets/external/widget.js";
  script.async = true;
  document.head.appendChild(script); // Append the script to the document head
});
</script>
