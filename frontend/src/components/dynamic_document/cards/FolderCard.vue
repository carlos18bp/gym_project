<template>
  <div
    class="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-5 cursor-pointer group"
    @click="handleCardClick"
  >
    <!-- Folder Icon and Color -->
    <div class="flex items-start justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="relative">
          <!-- Folder Icon with custom color -->
          <FolderIcon 
            class="w-10 h-10 text-gray-400"
            :style="{ color: folderColor.hex }"
          />
          <!-- Color indicator -->
          <div 
            class="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm"
            :style="{ backgroundColor: folderColor.hex }"
          ></div>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-medium text-gray-900 text-sm truncate group-hover:text-primary transition-colors">
            {{ folder.name }}
          </h3>
          <p class="text-xs text-gray-500 mt-0.5">
            {{ documentCount }} {{ documentCount === 1 ? 'documento' : 'documentos' }}
          </p>
        </div>
      </div>

      <!-- Action Menu -->
      <div class="relative folder-menu-container">
        <button
          @click.stop="toggleMenu"
          class="opacity-100 transition-opacity p-1.5 rounded-full hover:bg-gray-100"
          :class="{ 'bg-gray-100': showMenu }"
        >
          <EllipsisVerticalIcon class="w-4 h-4 text-gray-500" />
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="showMenu"
          class="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
        >
          <button
            @click.stop="handleEdit"
            class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <PencilIcon class="w-4 h-4" />
            Editar carpeta
          </button>
          <button
            @click.stop="handleAddDocuments"
            class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <PlusIcon class="w-4 h-4" />
            Agregar documentos
          </button>
          <div class="border-t border-gray-100 my-1"></div>
          <button
            @click.stop="handleDelete"
            class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <TrashIcon class="w-4 h-4" />
            Eliminar carpeta
          </button>
        </div>
      </div>
    </div>

    <!-- Documents Preview -->
    <div class="space-y-2">
      <!-- Document Categories Summary -->
      <div v-if="documentsByType.myDocuments.length > 0" class="flex items-center gap-2">
        <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
        <span class="text-xs text-gray-600">
          {{ documentsByType.myDocuments.length }} mis documentos
        </span>
      </div>
      
      <div v-if="documentsByType.useDocuments.length > 0" class="flex items-center gap-2">
        <div class="w-2 h-2 bg-green-500 rounded-full"></div>
        <span class="text-xs text-gray-600">
          {{ documentsByType.useDocuments.length }} formatos disponibles
        </span>
      </div>
      
      <div v-if="documentsByType.signatureDocuments.length > 0" class="flex items-center gap-2">
        <div class="w-2 h-2 bg-orange-500 rounded-full"></div>
        <span class="text-xs text-gray-600">
          {{ documentsByType.signatureDocuments.length }} documentos con firmas
        </span>
      </div>

      <!-- Empty folder state -->
      <div v-if="documentCount === 0" class="text-center py-3">
        <DocumentIcon class="w-8 h-8 text-gray-300 mx-auto mb-1" />
        <p class="text-xs text-gray-500">Carpeta vacía</p>
      </div>
    </div>

    <!-- Footer with creation date -->
    <div class="mt-4 pt-3 border-t border-gray-100">
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-500">
          Creada {{ formatDate(folder.created_at) }}
        </span>
        <ChevronRightIcon class="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>

    <!-- Click overlay for outside clicks -->
    <div
      v-if="showMenu"
      @click="closeMenu"
      class="fixed inset-0 z-5"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useUserStore } from '@/stores/auth/user';
import { getColorById } from '@/shared/color_palette';
import {
  FolderIcon,
  DocumentIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline';

// Props
const props = defineProps({
  folder: {
    type: Object,
    required: true
  }
});

// Emits
const emit = defineEmits(['click', 'edit', 'delete', 'add-documents']);

// Stores
const userStore = useUserStore();

// Reactive data
const showMenu = ref(false);
const menuJustClosed = ref(false);

// Computed properties
const currentUser = computed(() => userStore.currentUser);

const folderColor = computed(() => {
  return getColorById(props.folder.color_id) || { hex: '#6B7280', name: 'Gray' };
});

const documentCount = computed(() => {
  return props.folder.documents ? props.folder.documents.length : 0;
});

const documentsByType = computed(() => {
  if (!props.folder.documents) {
    return { myDocuments: [], useDocuments: [], signatureDocuments: [] };
  }

  const documents = props.folder.documents;
  
  return {
    myDocuments: documents.filter(doc => 
      doc.assigned_to === currentUser.value?.id && 
      (doc.state === 'Progress' || doc.state === 'Completed')
    ),
    useDocuments: documents.filter(doc => 
      doc.state === 'Published' && !doc.assigned_to
    ),
    signatureDocuments: documents.filter(doc => 
      doc.state === 'PendingSignatures' || doc.state === 'FullySigned'
    )
  };
});

// Methods
const handleCardClick = (event) => {
  // Check if click was on menu button or dropdown
  if (event.target.closest('.folder-menu-container')) {
    // If clicked on menu area, don't open folder
    return;
  }
  
  // If menu was just closed by click outside, don't open folder
  if (menuJustClosed.value) {
    return;
  }
  
  // Only open folder if menu is not open and click wasn't on menu
  if (!showMenu.value) {
    emit('click', props.folder);
  }
};

const toggleMenu = () => {
  showMenu.value = !showMenu.value;
};

const closeMenu = (fromClickOutside = false) => {
  showMenu.value = false;
  
  // If closed from click outside, set flag to prevent folder opening
  if (fromClickOutside) {
    menuJustClosed.value = true;
    // Clear flag after a short delay
    setTimeout(() => {
      menuJustClosed.value = false;
    }, 50);
  }
};

const handleEdit = () => {
  closeMenu(false); // false = not from click outside
  emit('edit', props.folder);
};

const handleDelete = () => {
  closeMenu(false); // false = not from click outside
  emit('delete', props.folder);
};

const handleAddDocuments = () => {
  closeMenu(false); // false = not from click outside
  emit('add-documents', props.folder);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'hoy';
  } else if (diffDays === 1) {
    return 'ayer';
  } else if (diffDays < 7) {
    return `hace ${diffDays} días`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  } else {
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
};

// Handle clicks outside to close menu
const handleClickOutside = (event) => {
  if (showMenu.value && !event.target.closest('.folder-menu-container')) {
    closeMenu(true); // true = closed from click outside
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.z-5 {
  z-index: 5;
}
</style> 