<template>
  <div>
    <h1>{{ msg }}</h1>
  </div>
</template>

<script setup>
const props = defineProps({
  msg: {
    type: String,
    required: true,
  },
});
</script>
