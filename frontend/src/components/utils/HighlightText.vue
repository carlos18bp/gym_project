<template>
    <span v-html="highlightedText"></span>
  </template>

  <script setup>
  import { computed } from 'vue';
  import { sanitizeHtml } from '@/composables/useSafeHtml.js';

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
   * Escapes HTML special characters so backend-supplied text cannot inject markup.
   * Applied before the highlight regex so the only HTML in the output is the
   * <span> we add ourselves (then re-validated by DOMPurify).
   */
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
    const safeText = escapeHtml(props.text);

    // If there is no query, return the escaped text directly.
    if (!props.query.trim()) {
      return safeText;
    }

    // Escape the query for regex AND HTML so the highlight wrapper is the only markup.
    const escapedQuery = escapeRegExp(escapeHtml(props.query.trim()));

    // Create a regex for global, case-insensitive matching.
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    // Replace matches with a span wrapping the match using the provided class.
    const wrapped = safeText.replace(regex, `<span class="${props.highlightClass} rounded-lg">$1</span>`);

    // Defense in depth: DOMPurify strips anything we missed.
    return sanitizeHtml(wrapped);
  });
  </script>
