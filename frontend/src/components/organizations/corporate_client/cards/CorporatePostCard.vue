<template>
  <div class="bg-white shadow rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
    <!-- Header with actions -->
    <div class="flex items-start justify-between mb-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center space-x-2 mb-2">
          <h3 class="text-lg font-semibold text-gray-900 truncate">
            {{ post.title }}
          </h3>
          <span v-if="post.is_pinned" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            <BookmarkIcon class="h-3 w-3 mr-1" />
            Fijado
          </span>
          <span 
            :class="post.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
          >
            {{ post.is_active ? 'Activo' : 'Inactivo' }}
          </span>
        </div>
        <p class="text-sm text-gray-500 mb-3">
          Creado {{ formatRelativeDate(post.created_at) }}
        </p>
      </div>
      
      <!-- Actions dropdown -->
      <div class="relative">
        <button
          @click="showActions = !showActions"
          class="inline-flex items-center p-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full"
        >
          <EllipsisVerticalIcon class="h-5 w-5" />
        </button>
        
        <!-- Actions menu -->
        <div v-if="showActions" class="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
          <div class="py-1">
            <button
              @click="editPost"
              class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <PencilIcon class="h-4 w-4 mr-3" />
              Editar
            </button>
            <button
              @click="togglePin"
              class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <BookmarkIcon class="h-4 w-4 mr-3" />
              {{ post.is_pinned ? 'Desfijar' : 'Fijar' }}
            </button>
            <button
              @click="toggleStatus"
              class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <component :is="post.is_active ? EyeSlashIcon : EyeIcon" class="h-4 w-4 mr-3" />
              {{ post.is_active ? 'Desactivar' : 'Activar' }}
            </button>
            <div class="border-t border-gray-100"></div>
            <button
              @click="deletePost"
              class="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              <TrashIcon class="h-4 w-4 mr-3" />
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="mb-4">
      <p class="text-gray-700 whitespace-pre-wrap">{{ post.content }}</p>
    </div>

    <!-- Link if available -->
    <div v-if="post.has_link && post.link_url" class="mb-4">
      <a
        :href="post.link_url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <LinkIcon class="h-4 w-4 mr-2" />
        {{ post.link_name || 'Ver enlace' }}
        <ArrowTopRightOnSquareIcon class="h-3 w-3 ml-1" />
      </a>
    </div>

    <!-- Footer with creation date -->
    <div class="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100">
      <div class="flex items-center space-x-4">
        <span class="flex items-center">
          <CalendarIcon class="h-3 w-3 mr-1" />
          {{ formatDate(post.created_at) }}
        </span>
        <span v-if="post.is_pinned" class="flex items-center text-yellow-600">
          <BookmarkIcon class="h-3 w-3 mr-1" />
          Fijado
        </span>
      </div>
      <div class="flex items-center space-x-2">
        <span :class="post.is_active ? 'text-green-600' : 'text-red-600'">
          {{ post.is_active ? 'Visible para miembros' : 'Oculto para miembros' }}
        </span>
      </div>
    </div>

    <!-- Click outside to close actions menu -->
    <div v-if="showActions" @click="showActions = false" class="fixed inset-0 z-0"></div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { 
  EllipsisVerticalIcon, 
  PencilIcon, 
  TrashIcon, 
  BookmarkIcon, 
  EyeIcon, 
  EyeSlashIcon, 
  LinkIcon, 
  ArrowTopRightOnSquareIcon, 
  CalendarIcon 
} from '@heroicons/vue/24/outline';

// Props
const props = defineProps({
  post: {
    type: Object,
    required: true
  },
  organizationId: {
    type: Number,
    required: true
  }
});

// Emits
const emit = defineEmits(['edit', 'delete', 'toggle-pin', 'toggle-status']);

// Reactive state
const showActions = ref(false);

// Methods
const editPost = () => {
  showActions.value = false;
  emit('edit', props.post);
};

const deletePost = () => {
  showActions.value = false;
  emit('delete', props.post);
};

const togglePin = () => {
  showActions.value = false;
  emit('toggle-pin', props.post);
};

const toggleStatus = () => {
  showActions.value = false;
  emit('toggle-status', props.post);
};

const formatDate = (dateString) => {
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
  
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) return `hace ${Math.ceil(diffDays / 7)} semanas`;
  
  return `el ${formatDate(dateString)}`;
};
</script>
