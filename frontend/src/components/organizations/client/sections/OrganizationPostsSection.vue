<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-medium text-gray-900">Anuncios de la Organización</h2>
          <p class="mt-1 text-sm text-gray-600">
            Información importante de la organización
          </p>
        </div>
        <button
          @click="refreshPosts"
          :disabled="isLoading"
          class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <ArrowPathIcon :class="[isLoading ? 'animate-spin' : '', 'h-4 w-4 mr-2']" />
          Actualizar
        </button>
      </div>
    </div>


    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-gray-600">Cargando anuncios...</span>
    </div>

    <!-- Posts list -->
    <div v-else-if="posts.length > 0" class="space-y-4">
      <!-- Pinned posts first -->
      <template v-for="post in pinnedPosts" :key="`pinned-${post.id}`">
        <ClientPostCard :post="post" />
      </template>
      
      <!-- Regular posts -->
      <template v-for="post in regularPosts" :key="`regular-${post.id}`">
        <ClientPostCard :post="post" />
      </template>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <SpeakerWaveIcon class="h-16 w-16 mx-auto mb-4 text-gray-300" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        {{ getEmptyStateTitle }}
      </h3>
      <p class="text-gray-600 mb-6">
        {{ getEmptyStateMessage }}
      </p>
      

      <!-- Info about organization communication -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
        <div class="flex">
          <InformationCircleIcon class="h-5 w-5 text-blue-400 mt-0.5" />
          <div class="ml-3 text-left">
            <h5 class="text-sm font-medium text-blue-800">Sobre los anuncios</h5>
            <div class="mt-1 text-sm text-blue-700 space-y-1">
              <p>• Los líderes de la organización pueden publicar anuncios importantes</p>
              <p>• Revisa esta sección regularmente para mantenerte informado</p>
              <p>• Los anuncios fijados aparecen en la parte superior</p>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { 
  SpeakerWaveIcon, 
  ArrowPathIcon, 
  InformationCircleIcon
} from '@heroicons/vue/24/outline';
import { useOrganizationPostsStore } from '@/stores/organization_posts';
import { showNotification } from '@/shared/notification_message';

// Components
import ClientPostCard from '../cards/ClientPostCard.vue';

// Props
const props = defineProps({
  organizationId: {
    type: Number,
    required: true
  }
});

// Store
const postsStore = useOrganizationPostsStore();

// Reactive state

// Computed properties
const isLoading = computed(() => postsStore.isLoadingPosts);
const allPosts = computed(() => postsStore.publicPosts);
const posts = computed(() => postsStore.sortedPublicPosts);

const pinnedPosts = computed(() => {
  return posts.value.filter(post => post.is_pinned);
});

const regularPosts = computed(() => {
  return posts.value.filter(post => !post.is_pinned);
});

const getEmptyStateTitle = computed(() => {
  return 'No hay anuncios disponibles';
});

const getEmptyStateMessage = computed(() => {
  return 'La organización aún no ha publicado ningún anuncio. Los anuncios importantes aparecerán aquí.';
});

// Methods
const loadPosts = async () => {
  try {
    await postsStore.getPublicPosts(props.organizationId);
  } catch (error) {
    console.error('Error loading posts:', error);
    showNotification('Error al cargar los anuncios', 'error');
  }
};

const refreshPosts = () => {
  loadPosts();
};

// Lifecycle
onMounted(() => {
  loadPosts();
});

// Watchers
watch(() => props.organizationId, () => {
  if (props.organizationId) {
    loadPosts();
  }
});
</script>
