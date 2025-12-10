<template>
  <ModalTransition v-if="folder">
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="border-b px-6 py-4 flex-shrink-0">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-3">
              <div 
                class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                :style="{ backgroundColor: folderColor.hex + '20' }"
              >
                <FolderIcon 
                  class="h-6 w-6" 
                  :style="{ color: folderColor.hex }"
                />
              </div>
              <div>
                <h3 class="text-xl font-semibold text-gray-900">{{ folder.name }}</h3>
                <p class="text-sm text-gray-600">{{ folder.documents.length }} documento{{ folder.documents.length !== 1 ? 's' : '' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="handleAddDocuments"
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <PlusIcon class="w-5 h-5" />
                Agregar documentos
              </button>
              <button
                @click="handleClose"
                class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon class="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- Table -->
          <div v-if="folder.documents.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-200">
            <div class="overflow-x-auto" :style="{ minHeight: getMinHeight() }">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documento
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Etiquetas
                    </th>
                    <th scope="col" class="w-16 px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr
                    v-for="(document, index) in folder.documents"
                    :key="document.id"
                    class="hover:bg-gray-50 cursor-pointer transition-colors"
                    @click="handleDocumentClick(document)"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                          <div class="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <DocumentTextIcon class="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div class="ml-4">
                          <div class="text-sm font-medium text-gray-900">{{ document.title }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="text-sm text-gray-600">{{ getDocumentType(document) }}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span 
                        class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                        :class="getStatusClasses(document)"
                      >
                        {{ getStatusText(document) }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex flex-wrap gap-1">
                        <span
                          v-for="tag in document.tags?.slice(0, 2)"
                          :key="tag.id"
                          class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                          :class="getTagClasses(tag)"
                        >
                          {{ tag.name }}
                        </span>
                        <span
                          v-if="document.tags && document.tags.length > 2"
                          class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600"
                        >
                          +{{ document.tags.length - 2 }}
                        </span>
                        <span v-if="!document.tags || document.tags.length === 0" class="text-sm text-gray-400">-</span>
                      </div>
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
                            folder.documents.length > 2 && index > 0 && index >= folder.documents.length - 3
                              ? 'absolute right-0 z-[9999] bottom-full mb-2 w-48 origin-bottom-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'
                              : 'absolute right-0 z-[9999] mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none'
                          ]"
                        >
                          <div class="py-1">
                            <MenuItem v-slot="{ active }">
                              <a @click="handleDocumentClick(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700 cursor-pointer']">
                                Ver documento
                              </a>
                            </MenuItem>
                            <MenuItem v-slot="{ active }">
                              <a @click="handleRemoveDocument(document)" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-red-600 cursor-pointer']">
                                Quitar de carpeta
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

          <!-- Empty state -->
          <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <DocumentIcon class="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">Esta carpeta está vacía</h4>
            <p class="text-gray-600 mb-4">Agrega documentos para organizar tu trabajo</p>
            <button
              @click="handleAddDocuments"
              class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusIcon class="w-5 h-5" />
              Agregar documentos
            </button>
          </div>
        </div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { 
  XMarkIcon, 
  PlusIcon, 
  DocumentIcon, 
  FolderIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon
} from '@heroicons/vue/24/outline';
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import { useUserStore } from '@/stores/auth/user';
import { useDynamicDocumentStore } from '@/stores/dynamic_document';

// Props
const props = defineProps({
  folder: {
    type: Object,
    default: null
  }
});

// Emits
const emit = defineEmits([
  'close',
  'add-documents',
  'remove-document',
  'view-document',
  'use-document',
  'document-action'
]);

// Stores
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();

// Menu refs for scroll handling
const menuButtonRefs = ref({});
const menuItemsRefs = ref({});
const isAnyMenuOpen = ref(false);
const openMenuIndex = ref(-1);

// Folder colors
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

// Computed folder color
const folderColor = computed(() => {
  if (!props.folder) return folderColors[0];
  if (props.folder.color) {
    return folderColors.find(c => c.name === props.folder.color) || folderColors[0];
  }
  const index = props.folder.id % folderColors.length;
  return folderColors[index];
});

// Get document type
const getDocumentType = (document) => {
  if (document.state === 'Published' || document.state === 'Draft') {
    return 'Formato';
  }
  if (document.state === 'PendingSignatures' || document.state === 'FullySigned') {
    return 'Para Firmar';
  }
  if (document.state === 'Progress' || document.state === 'Completed') {
    return 'Mis Documentos';
  }
  return 'Documento';
};

// Get status text
const getStatusText = (document) => {
  const stateMap = {
    'Published': 'Publicado',
    'Draft': 'Borrador',
    'Progress': 'En Progreso',
    'Completed': 'Completado',
    'PendingSignatures': 'Pendiente Firma',
    'FullySigned': 'Firmado'
  };
  return stateMap[document.state] || document.state;
};

// Get status classes
const getStatusClasses = (document) => {
  const classMap = {
    'Published': 'bg-green-100 text-green-700 border border-green-200',
    'Draft': 'bg-gray-100 text-gray-700 border border-gray-200',
    'Progress': 'bg-blue-100 text-blue-700 border border-blue-200',
    'Completed': 'bg-green-100 text-green-700 border border-green-200',
    'PendingSignatures': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    'FullySigned': 'bg-green-100 text-green-700 border border-green-200'
  };
  return classMap[document.state] || 'bg-gray-100 text-gray-700 border border-gray-200';
};

// Get tag classes
const getTagClasses = (tag) => {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-pink-100 text-pink-700',
    'bg-yellow-100 text-yellow-700',
    'bg-green-100 text-green-700'
  ];
  const index = tag.id % colors.length;
  return colors[index];
};

// Methods
const handleClose = () => {
  emit('close');
};

const handleAddDocuments = () => {
  emit('add-documents', props.folder);
};

const handleRemoveDocument = (document) => {
  emit('remove-document', { folderId: props.folder.id, documentId: document.id });
};

const handleDocumentClick = (document) => {
  // Determine the action based on document type
  const docType = getDocumentType(document);
  if (docType === 'Formato') {
    emit('use-document', document);
  } else {
    emit('view-document', document);
  }
};

// Get dynamic minHeight based on open menu index
const getMinHeight = () => {
  if (!isAnyMenuOpen.value || !props.folder) return 'auto';
  
  // Si hay 1 elemento, siempre 280px
  if (props.folder.documents.length === 1) return '280px';
  
  // Si hay 2 elementos
  if (props.folder.documents.length === 2) {
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
