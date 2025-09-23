<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-medium text-gray-900">Posts de la Organización</h2>
          <p class="mt-1 text-sm text-gray-600">
            Comparte anuncios e información importante con los miembros
          </p>
        </div>
        <div class="flex space-x-3">
          <button
            @click="refreshPosts"
            :disabled="isLoading"
            class="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <ArrowPathIcon :class="[isLoading ? 'animate-spin' : '', 'h-4 w-4 mr-2']" />
            Actualizar
          </button>
          <button
            @click="openCreateModal"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon class="h-4 w-4 mr-2" />
            Nuevo Post
          </button>
        </div>
      </div>
    </div>


    <!-- Loading state -->
    <div v-if="isLoading" class="flex justify-center items-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span class="ml-2 text-gray-600">Cargando posts...</span>
    </div>

    <!-- Posts list -->
    <div v-else-if="posts.length > 0" class="space-y-4">
      <CorporatePostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
        :organization-id="organizationId"
        @edit="handleEditPost"
        @delete="handleDeletePost"
        @toggle-pin="handleTogglePin"
        @toggle-status="handleToggleStatus"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <DocumentIcon class="h-16 w-16 mx-auto mb-4 text-gray-300" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        {{ getEmptyStateTitle }}
      </h3>
      <p class="text-gray-600 mb-6">
        {{ getEmptyStateMessage }}
      </p>
      
      <!-- Action based on state -->
      <div v-if="allPosts.length === 0">
        <button
          @click="openCreateModal"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          Crear Primer Post
        </button>
        
        <!-- Info box -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto mt-6">
          <div class="flex">
            <InformationCircleIcon class="h-5 w-5 text-blue-400 mt-0.5" />
            <div class="ml-3 text-left">
              <h5 class="text-sm font-medium text-blue-800">¿Cómo usar los posts?</h5>
              <div class="mt-1 text-sm text-blue-700 space-y-1">
                <p>• Comparte anuncios importantes con tu equipo</p>
                <p>• Incluye enlaces a documentos o recursos</p>
                <p>• Fija posts importantes para mantenerlos arriba</p>
                <p>• Activa/desactiva posts según sea necesario</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </div>

    <!-- Create/Edit Post Modal -->
    <PostFormModal
      :visible="showPostModal"
      :post="selectedPost"
      :organization-id="organizationId"
      @close="closePostModal"
      @saved="handlePostSaved"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :visible="showDeleteModal"
      :title="`¿Eliminar post '${selectedPost?.title}'?`"
      :message="'Esta acción no se puede deshacer. El post será eliminado permanentemente.'"
      confirm-text="Sí, eliminar"
      confirm-color="red"
      :is-loading="postsStore.isDeletingPost"
      @confirm="confirmDelete"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { 
  DocumentIcon, 
  PlusIcon, 
  ArrowPathIcon, 
  InformationCircleIcon
} from '@heroicons/vue/24/outline';
import { useOrganizationPostsStore } from '@/stores/organization_posts';
import { showNotification } from '@/shared/notification_message';

// Components
import CorporatePostCard from '../cards/CorporatePostCard.vue';
import PostFormModal from '../../modals/PostFormModal.vue';
import ConfirmationModal from '../../modals/ConfirmationModal.vue';

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
const showPostModal = ref(false);
const showDeleteModal = ref(false);
const selectedPost = ref(null);

// Computed properties
const isLoading = computed(() => postsStore.isLoadingPosts);
const allPosts = computed(() => postsStore.managementPosts);
const posts = computed(() => postsStore.sortedManagementPosts);

const getEmptyStateTitle = computed(() => {
  return 'No hay posts creados';
});

const getEmptyStateMessage = computed(() => {
  return 'Crea tu primer post para compartir información importante con los miembros de tu organización.';
});

// Methods
const loadPosts = async () => {
  try {
    await postsStore.getManagementPosts(props.organizationId);
  } catch (error) {
    console.error('Error loading posts:', error);
    showNotification('Error al cargar los posts', 'error');
  }
};

const refreshPosts = () => {
  loadPosts();
};

const openCreateModal = () => {
  selectedPost.value = null;
  showPostModal.value = true;
};

const closePostModal = () => {
  showPostModal.value = false;
  selectedPost.value = null;
};

const handleEditPost = (post) => {
  selectedPost.value = post;
  showPostModal.value = true;
};

const handleDeletePost = (post) => {
  selectedPost.value = post;
  showDeleteModal.value = true;
};

const confirmDelete = async () => {
  try {
    await postsStore.deletePost(props.organizationId, selectedPost.value.id);
    showNotification(`Post "${selectedPost.value.title}" eliminado exitosamente`, 'success');
    showDeleteModal.value = false;
    selectedPost.value = null;
  } catch (error) {
    console.error('Error deleting post:', error);
    showNotification('Error al eliminar el post', 'error');
  }
};

const handleTogglePin = async (post) => {
  try {
    await postsStore.togglePinPost(props.organizationId, post.id);
    const action = post.is_pinned ? 'desfijado' : 'fijado';
    showNotification(`Post ${action} exitosamente`, 'success');
  } catch (error) {
    console.error('Error toggling pin:', error);
    showNotification('Error al cambiar el estado de fijado', 'error');
  }
};

const handleToggleStatus = async (post) => {
  try {
    await postsStore.togglePostStatus(props.organizationId, post.id);
    const action = post.is_active ? 'desactivado' : 'activado';
    showNotification(`Post ${action} exitosamente`, 'success');
  } catch (error) {
    console.error('Error toggling status:', error);
    showNotification('Error al cambiar el estado del post', 'error');
  }
};

const handlePostSaved = () => {
  closePostModal();
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
