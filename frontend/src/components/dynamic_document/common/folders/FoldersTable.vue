<template>
  <div class="folders-table">
    <!-- Table -->
    <div v-if="!isLoading && filteredFolders.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200" style="overflow-x: visible; overflow-y: hidden;">
      <div class="overflow-x-auto" :style="{ minHeight: getMinHeight(), overflowY: 'visible' }">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Carpeta
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Documentos
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Creada
              </th>
              <th scope="col" class="w-16 px-6 py-3"></th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="(folder, index) in filteredFolders"
              :key="folder.id"
              class="hover:bg-gray-50 cursor-pointer transition-colors"
              @click="handleFolderClick(folder)"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <div class="flex-shrink-0 h-10 w-10">
                    <div 
                      class="h-10 w-10 rounded-lg flex items-center justify-center"
                      :style="{ backgroundColor: getFolderColor(folder).hex + '20' }"
                    >
                      <FolderIcon 
                        class="h-6 w-6" 
                        :style="{ color: getFolderColor(folder).hex }"
                      />
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="text-sm font-medium text-gray-900">{{ folder.name }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <DocumentTextIcon class="h-5 w-5 text-gray-400" />
                  <span class="text-sm text-gray-900">
                    {{ folder.documents?.length || 0 }} documento{{ (folder.documents?.length || 0) !== 1 ? 's' : '' }}
                  </span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(folder.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" @click.stop>
                <Menu as="div" class="relative inline-block text-left" v-slot="{ open }">
                  <MenuButton 
                    :ref="el => setMenuButtonRef(el, index)"
                    @click="handleMenuOpen(index, open)"
                    class="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100"
                  >
                    <EllipsisVerticalIcon class="h-5 w-5 text-gray-500" />
                  </MenuButton>
                  <MenuItems 
                    :ref="el => setMenuItemsRef(el, index)"
                    :class="[
                      filteredFolders.length > 2 && index > 0 && index >= filteredFolders.length - 3
                        ? 'absolute right-0 z-[9999] bottom-full mb-2 w-48 origin-bottom-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'
                        : 'absolute right-0 z-[9999] mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'
                    ]"
                  >
                    <div class="py-1">
                      <MenuItem v-slot="{ active }">
                        <a @click="handleFolderClick(folder)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Ver carpeta
                        </a>
                      </MenuItem>
                      <MenuItem v-slot="{ active }">
                        <a @click="handleAddDocuments(folder)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Agregar documentos
                        </a>
                      </MenuItem>
                      <MenuItem v-slot="{ active }">
                        <a @click="handleEditFolder(folder)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                          Editar
                        </a>
                      </MenuItem>
                      <MenuItem v-slot="{ active }">
                        <a @click="handleDeleteFolder(folder)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-red-600 cursor-pointer']">
                          Eliminar
                        </a>
                      </MenuItem>
                    </div>
                  </MenuItems>
                </Menu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading && sortedFolders.length === 0" class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <FolderIcon class="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No tienes carpetas aún</h3>
      <p class="text-gray-600 mb-6">Crea tu primera carpeta para organizar tus documentos</p>
      <button
        @click="handleCreateFolder"
        class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
      >
        <PlusIcon class="w-5 h-5" />
        Crear Primera Carpeta
      </button>
    </div>

    <!-- No results state -->
    <div v-else-if="!isLoading && sortedFolders.length > 0 && filteredFolders.length === 0" class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <FolderIcon class="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No se encontraron carpetas</h3>
      <p class="text-gray-600">No hay carpetas que coincidan con tu búsqueda</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { 
  FolderIcon, 
  PlusIcon, 
  DocumentTextIcon,
  EllipsisVerticalIcon 
} from '@heroicons/vue/24/outline';

// Props
const props = defineProps({
  sortedFolders: {
    type: Array,
    required: true
  },
  searchQuery: {
    type: String,
    default: ''
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits([
  'folder-click',
  'edit-folder', 
  'delete-folder', 
  'add-documents',
  'create-folder'
]);

// Menu refs for scroll handling
const menuButtonRefs = ref({});
const menuItemsRefs = ref({});
const isAnyMenuOpen = ref(false);
const openMenuIndex = ref(-1);

// Computed
const filteredFolders = computed(() => {
  if (!props.searchQuery.trim()) return props.sortedFolders;
  
  const query = props.searchQuery.toLowerCase();
  return props.sortedFolders.filter(folder => 
    folder.name.toLowerCase().includes(query)
  );
});

// Folder colors (same as FolderCard)
const folderColors = [
  { name: 'blue', hex: '#3B82F6' },
  { name: 'purple', hex: '#8B5CF6' },
  { name: 'pink', hex: '#EC4899' },
  { name: 'green', hex: '#10B981' },
  { name: 'yellow', hex: '#F59E0B' },
  { name: 'red', hex: '#EF4444' },
  { name: 'indigo', hex: '#6366F1' },
  { name: 'teal', hex: '#14B8A6' }
];

// Get folder color
const getFolderColor = (folder) => {
  if (folder.color) {
    return folderColors.find(c => c.name === folder.color) || folderColors[0];
  }
  // Default color based on folder id
  const index = folder.id % folderColors.length;
  return folderColors[index];
};

// Format date
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
  if (diffDays < 365) return `Hace ${Math.floor(diffDays / 30)} meses`;
  
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Methods
const handleFolderClick = (folder) => {
  emit('folder-click', folder);
};

const handleEditFolder = (folder) => {
  emit('edit-folder', folder);
};

const handleDeleteFolder = (folder) => {
  emit('delete-folder', folder);
};

const handleAddDocuments = (folder) => {
  emit('add-documents', folder);
};

const handleCreateFolder = () => {
  emit('create-folder');
};

// Get dynamic minHeight based on open menu index
const getMinHeight = () => {
  if (!isAnyMenuOpen.value) return 'auto';
  
  // Si hay 1 elemento, siempre 280px
  if (filteredFolders.value.length === 1) return '280px';
  
  // Si hay 2 elementos
  if (filteredFolders.value.length === 2) {
    // Si es el segundo elemento (índice 1), necesita más espacio
    return openMenuIndex.value === 1 ? '340px' : '280px';
  }
  
  // Para 3 o más elementos, usar el estándar
  return '280px';
};

// Menu refs handlers
const setMenuButtonRef = (el, index) => {
  if (el) {
    menuButtonRefs.value[index] = el;
  }
};

const setMenuItemsRef = (el, index) => {
  if (el) {
    menuItemsRefs.value[index] = el;
  }
};

// Handle menu open and scroll into view if needed
const handleMenuOpen = (index, wasOpen) => {
  // Track if menu is being opened or closed
  isAnyMenuOpen.value = !wasOpen;
  openMenuIndex.value = wasOpen ? -1 : index;
  
  // Use setTimeout to ensure the menu is rendered before checking position
  if (!wasOpen) {
    setTimeout(() => {
      const menuItems = menuItemsRefs.value[index];
      
      if (menuItems) {
        // Get the actual DOM element (Headless UI components wrap the element)
        const menuElement = menuItems.$el || menuItems;
        
        if (menuElement && menuElement.getBoundingClientRect) {
          const rect = menuElement.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          
          // Special handling for first row (index 0) - always ensure it's fully visible
          if (index === 0) {
            // Check if menu extends below viewport
            if (rect.bottom > viewportHeight - 20) {
              const scrollAmount = rect.bottom - viewportHeight + 40;
              window.scrollBy({ 
                top: scrollAmount, 
                behavior: 'smooth'
              });
            }
          } else {
            // For other rows, use standard logic
            
            // Check if menu is cut off at the bottom of viewport
            if (rect.bottom > viewportHeight - 10) {
              const scrollAmount = rect.bottom - viewportHeight + 30;
              window.scrollBy({ 
                top: scrollAmount, 
                behavior: 'smooth'
              });
            }
            // Check if menu is cut off at the top of viewport
            else if (rect.top < 80) {
              const scrollAmount = rect.top - 100;
              window.scrollBy({ 
                top: scrollAmount, 
                behavior: 'smooth'
              });
            }
          }
        }
      }
    }, 100);
  }
};
</script>

<style scoped>
.folders-table {
  @apply w-full;
}
</style>
