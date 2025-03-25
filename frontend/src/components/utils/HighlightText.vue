<template>
    <span v-html="highlightedText"></span>
  </template>
  
  <script setup>
  import { computed } from 'vue';
  
  const props = defineProps({
    text: {
      type: String,
      required: true,
    },
    query: {
      type: String,
      default: '',
    },
    highlightClass: {
      type: String,
      default: 'underline', // You can change the default class here
    },
  });
  
  /**
   * Escapes special regex characters in a string.
   *
   * @param {string} str - The string to escape.
   * @returns {string} - The escaped string.
   */
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  const highlightedText = computed(() => {
    // If there is no query, return the original text
    if (!props.query.trim()) {
      return props.text;
    }
    
    // Escape the query
    const escapedQuery = escapeRegExp(props.query.trim());
    
    // Create a regex for global, case-insensitive matching
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    
    // Replace matches with a span wrapping the match using the provided class
    return props.text.replace(regex, `<span class="${props.highlightClass} rounded-lg">$1</span>`);
  });
  </script>
  