<template>
  <div class="bg-white shadow rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
    <!-- Header -->
    <div class="mb-4">
      <div class="flex items-center space-x-2 mb-2">
        <h3 class="text-lg font-semibold text-gray-900">
          {{ post.title }}
        </h3>
        <span v-if="post.is_pinned" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
          <BookmarkIcon class="h-3 w-3 mr-1" />
          Fijado
        </span>
      </div>
      
      <div class="flex items-center text-sm text-gray-500 space-x-4">
        <div class="flex items-center">
          <UserIcon class="h-4 w-4 mr-1" />
          <span>{{ post.author_name }}</span>
        </div>
        <div class="flex items-center">
          <CalendarIcon class="h-4 w-4 mr-1" />
          <span>{{ formatRelativeDate(post.created_at) }}</span>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="mb-4">
      <p class="text-gray-700 whitespace-pre-wrap leading-relaxed">{{ post.content }}</p>
    </div>

    <!-- Link if available -->
    <div v-if="post.has_link && post.link_url" class="mb-4">
      <a
        :href="post.link_url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      >
        <LinkIcon class="h-4 w-4 mr-2" />
        {{ post.link_name || 'Ver enlace' }}
        <ArrowTopRightOnSquareIcon class="h-3 w-3 ml-2" />
      </a>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100">
      <div class="flex items-center space-x-4">
        <span class="flex items-center">
          <CalendarIcon class="h-3 w-3 mr-1" />
          {{ formatFullDate(post.created_at) }}
        </span>
        <span v-if="post.is_pinned" class="flex items-center text-yellow-600">
          <BookmarkIcon class="h-3 w-3 mr-1" />
          Anuncio Destacado
        </span>
      </div>
      
      <!-- Visual indicator for recent posts -->
      <div v-if="isRecentPost" class="flex items-center text-green-600">
        <span class="h-2 w-2 bg-green-400 rounded-full mr-1 animate-pulse"></span>
        Reciente
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { 
  BookmarkIcon, 
  LinkIcon, 
  ArrowTopRightOnSquareIcon, 
  CalendarIcon,
  UserIcon
} from '@heroicons/vue/24/outline';

// Props
const props = defineProps({
  post: {
    type: Object,
    required: true
  }
});

// Computed properties
const isRecentPost = computed(() => {
  const postDate = new Date(props.post.created_at);
  const now = new Date();
  const diffTime = Math.abs(now - postDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays <= 3; // Consider posts from last 3 days as recent
});

// Methods
const formatFullDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatRelativeDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.ceil(diffTime / (1000 * 60));
  
  if (diffMinutes < 60) {
    if (diffMinutes <= 1) return 'hace un momento';
    return `hace ${diffMinutes} minutos`;
  }
  
  if (diffHours < 24) {
    if (diffHours === 1) return 'hace 1 hora';
    return `hace ${diffHours} horas`;
  }
  
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) {
    const weeks = Math.ceil(diffDays / 7);
    return `hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }
  
  const months = Math.ceil(diffDays / 30);
  if (months < 12) {
    return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  }
  
  return formatFullDate(dateString);
};
</script>
