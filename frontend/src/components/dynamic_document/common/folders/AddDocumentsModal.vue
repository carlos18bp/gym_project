<template>
  <ModalTransition v-if="isVisible && folder">
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        <!-- Header -->
        <div class="flex justify-between items-center p-6 border-b">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Agregar Documentos</h3>
            <p class="text-sm text-gray-600">Selecciona documentos para agregar a "{{ folder.name }}"</p>
          </div>
          <button @click="handleClose" class="text-gray-400 hover:text-gray-500">
            <XMarkIcon class="w-6 h-6" />
          </button>
        </div>

        <!-- Document Categories Tabs -->
        <div class="border-b">
          <nav class="flex space-x-8 px-6" aria-label="Tabs">
            <button
              v-for="category in documentCategories"
              :key="category.name"
              @click="activeDocumentCategory = category.name"
              :class="[
                activeDocumentCategory === category.name
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
              ]"
            >
              {{ category.label }}
              <span class="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                {{ getAvailableDocumentsByCategory(category.name).length }}
              </span>
            </button>
          </nav>
        </div>

        <!-- Documents Content -->
        <div class="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <template v-for="document in getAvailableDocumentsByCategory(activeDocumentCategory)" :key="document.id">
              <div class="relative">
                <!-- My Documents -->
                <DocumentCard
                  v-if="activeDocumentCategory === 'my-documents'"
                  :document="document"
                  :highlighted-doc-id="null"
                  :show-tags="true"
                  :show-client-name="false"
                  :additional-classes="selectedDocuments.includes(document.id) ? 'ring-2 ring-primary bg-primary-50' : ''"
                  @click="toggleDocumentSelection(document.id)"
                />

                <!-- Use Documents -->
                <UseDocumentCard
                  v-if="activeDocumentCategory === 'use-documents'"
                  :document="document"
                  :show-tags="true"
                  :additional-classes="selectedDocuments.includes(document.id) ? 'ring-2 ring-primary bg-primary-50' : ''"
                  @click="toggleDocumentSelection(document.id)"
                />

                <!-- Signature Documents -->
                <SignatureDocumentCard
                  v-if="activeDocumentCategory === 'signature-documents'"
                  :document="document"
                  :highlighted-doc-id="null"
                  :show-tags="true"
                  :additional-classes="selectedDocuments.includes(document.id) ? 'ring-2 ring-primary bg-primary-50' : ''"
                  @click="toggleDocumentSelection(document.id)"
                />

                <!-- Selection indicator -->
                <div
                  v-if="selectedDocuments.includes(document.id)"
                  class="absolute top-2 left-2 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center"
                >
                  <CheckIcon class="w-4 h-4" />
                </div>
              </div>
            </template>
          </div>

          <!-- No documents available message -->
          <div v-if="getAvailableDocumentsByCategory(activeDocumentCategory).length === 0" class="text-center py-12">
            <DocumentIcon class="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">No hay documentos disponibles</h4>
            <p class="text-gray-600">No tienes documentos de esta categoría que no estén ya en la carpeta</p>
          </div>
        </div>

        <!-- Footer with actions -->
        <div class="flex justify-between items-center p-6 border-t bg-gray-50">
          <div class="text-sm text-gray-600">
            {{ selectedDocuments.length }} documento(s) seleccionado(s)
          </div>
          <div class="flex gap-3">
            <button
              @click="handleClose"
              class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              @click="handleAddSelectedDocuments"
              :disabled="selectedDocuments.length === 0 || isSubmitting"
              class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ isSubmitting ? 'Agregando...' : `Agregar ${selectedDocuments.length} documento(s)` }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useDynamicDocumentStore } from '@/stores/dynamicDocument';
import { useUserStore } from '@/stores/user';

// Icons
import { 
  XMarkIcon, 
  DocumentIcon,
  CheckIcon 
} from '@heroicons/vue/24/outline';

// Components
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import { DocumentCard, UseDocumentCard, SignatureDocumentCard } from '@/components/dynamic_document/cards';

// Props
const props = defineProps({
  isVisible: {
    type: Boolean,
    required: true
  },
  folder: {
    type: Object,
    default: null
  }
});

// Emits
const emit = defineEmits(['close', 'add-documents']);

// Stores
const documentStore = useDynamicDocumentStore();
const userStore = useUserStore();

// Reactive data
const selectedDocuments = ref([]);
const activeDocumentCategory = ref('my-documents');
const isSubmitting = ref(false);

// Document categories for the add documents modal
const documentCategories = [
  { name: 'my-documents', label: 'Mis Documentos' },
  { name: 'use-documents', label: 'Formatos Disponibles' },
  { name: 'signature-documents', label: 'Documentos para Firmar' }
];

// Computed
const currentUser = computed(() => userStore.currentUser);

// Watch for visibility changes
watch(() => props.isVisible, (isVisible) => {
  if (isVisible) {
    selectedDocuments.value = [];
    activeDocumentCategory.value = 'my-documents';
  }
});

// Methods
const getAvailableDocumentsByCategory = (category) => {
  if (!props.folder) return [];
  
  const folderDocumentIds = props.folder.documents.map(doc => doc.id);
  let availableDocuments = [];
  
  switch (category) {
    case 'my-documents':
      availableDocuments = documentStore.progressAndCompletedDocumentsByClient(currentUser.value?.id);
      break;
    case 'use-documents':
      availableDocuments = documentStore.publishedDocumentsUnassigned;
      break;
    case 'signature-documents':
      availableDocuments = [
        ...documentStore.pendingSignatureDocuments,
        ...documentStore.fullySignedDocuments
      ].filter(doc => 
        doc.assigned_to === currentUser.value?.id ||
        doc.signatures?.some(sig => sig.user_id === currentUser.value?.id)
      );
      break;
  }
  
  return availableDocuments.filter(doc => !folderDocumentIds.includes(doc.id));
};

const toggleDocumentSelection = (documentId) => {
  const index = selectedDocuments.value.indexOf(documentId);
  if (index > -1) {
    selectedDocuments.value.splice(index, 1);
  } else {
    selectedDocuments.value.push(documentId);
  }
};

const handleClose = () => {
  emit('close');
};

const handleAddSelectedDocuments = async () => {
  if (selectedDocuments.value.length === 0) return;
  
  isSubmitting.value = true;
  
  try {
    await emit('add-documents', selectedDocuments.value);
  } finally {
    isSubmitting.value = false;
  }
};
</script> 