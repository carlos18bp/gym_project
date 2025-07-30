<template>
  <ModalTransition v-if="folder">
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <!-- Header - Responsive -->
        <div class="border-b">
          <!-- Desktop Header -->
          <div class="hidden sm:flex justify-between items-center p-6">
            <div class="flex items-center gap-3">
              <div 
                class="w-8 h-8 rounded-full flex-shrink-0"
                :style="{ backgroundColor: folderColor.hex }"
              ></div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900">{{ folder.name }}</h3>
                <p class="text-sm text-gray-600">{{ folder.documents.length }} documento{{ folder.documents.length !== 1 ? 's' : '' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="handleAddDocuments"
                class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <PlusIcon class="w-4 h-4" />
                Agregar documentos
              </button>
              <button
                @click="handleClose"
                class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Mobile Header -->
          <div class="sm:hidden">
            <!-- Top Row: Title and Close Button -->
            <div class="flex justify-between items-center p-4 pb-2">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div 
                  class="w-7 h-7 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: folderColor.hex }"
                ></div>
                <div class="min-w-0 flex-1">
                  <h3 class="text-lg font-semibold text-gray-900 truncate">{{ folder.name }}</h3>
                  <p class="text-sm text-gray-600">{{ folder.documents.length }} documento{{ folder.documents.length !== 1 ? 's' : '' }}</p>
                </div>
              </div>
              <button
                @click="handleClose"
                class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2"
              >
                <XMarkIcon class="w-5 h-5" />
              </button>
            </div>
            
            <!-- Bottom Row: Add Documents Button -->
            <div class="px-4 pb-4">
              <button
                @click="handleAddDocuments"
                class="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <PlusIcon class="w-4 h-4" />
                Agregar documentos
              </button>
            </div>
          </div>
        </div>

        <!-- Content -->
        <div class="p-4 sm:p-6 overflow-y-auto max-h-[70vh]">
          <div class="space-y-6">
            <!-- Mis Documentos -->
            <div v-if="folderDocumentsByType.myDocuments.length > 0">
              <h4 class="text-base font-semibold text-gray-900 mb-3">Mis Documentos</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <DocumentCard
                  v-for="document in folderDocumentsByType.myDocuments"
                  :key="document.id"
                  :document="document"
                  :card-type="'client'"
                  :card-context="'folder'"
                  :highlighted-doc-id="null"
                  :show-tags="true"
                  :show-client-name="false"
                  :additional-classes="'relative'"
                  :document-store="documentStore"
                  :user-store="userStore"
                  @click="handleDocumentClick"
                  @refresh="$emit('refresh')"
                  @remove-from-folder="handleRemoveDocumentFromCard"
                />
              </div>
            </div>

            <!-- Formatos Disponibles -->
            <div v-if="folderDocumentsByType.useDocuments.length > 0">
              <h4 class="text-base font-semibold text-gray-900 mb-3">Formatos Disponibles</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <UseDocumentCard
                  v-for="document in folderDocumentsByType.useDocuments"
                  :key="document.id"
                  :document="document"
                  :card-context="'folder'"
                  :show-menu-options="true"
                  :document-store="documentStore"
                  :user-store="userStore"
                  @click="handleUseDocument"
                  @remove-from-folder="handleRemoveDocumentFromCard"
                />
              </div>
            </div>

            <!-- Documentos para Firmar -->
            <div v-if="folderDocumentsByType.signatureDocuments.length > 0">
              <h4 class="text-base font-semibold text-gray-900 mb-3">Documentos para Firmar</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <SignatureDocumentCard
                  v-for="document in folderDocumentsByType.signatureDocuments"
                  :key="document.id"
                  :document="document"
                  :card-context="'folder'"
                  :highlighted-doc-id="null"
                  :document-store="documentStore"
                  :user-store="userStore"
                  @refresh="$emit('refresh')"
                  @remove-from-folder="handleRemoveDocumentFromCard"
                />
              </div>
            </div>

            <!-- Empty state -->
            <div v-if="folder.documents.length === 0" class="text-center py-8 sm:py-12">
              <div class="text-gray-400 mb-4">
                <DocumentIcon class="w-10 h-10 sm:w-12 sm:h-12 mx-auto" />
              </div>
              <h4 class="text-lg font-medium text-gray-900 mb-2">Esta carpeta está vacía</h4>
              <p class="text-gray-600 mb-4 text-sm sm:text-base">Agrega documentos para organizar tu trabajo</p>
              <button
                @click="handleAddDocuments"
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
              >
                <PlusIcon class="w-4 h-4" />
                Agregar documentos
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { computed, watch } from 'vue';
import { XMarkIcon, PlusIcon, DocumentIcon } from '@heroicons/vue/24/outline';
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import { DocumentCard, UseDocumentCard, SignatureDocumentCard } from '@/components/dynamic_document/cards';
import { useUserStore } from '@/stores/auth/user';
import { useDynamicDocumentStore } from '@/stores/dynamic_document';
import { getColorById } from '@/shared/color_palette';

// Props
const props = defineProps({
  folder: {
    type: Object,
    default: null
  }
});

// Emits
const emit = defineEmits(['close', 'add-documents', 'remove-document', 'view-document', 'use-document', 'refresh']);

// Stores
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();

// Computed
const currentUser = computed(() => userStore.currentUser);

const folderColor = computed(() => {
  if (!props.folder?.color_id) {
    return { hex: '#6B7280' }; // Default gray
  }
  return getColorById(props.folder.color_id) || { hex: '#6B7280' };
});

const folderDocumentsByType = computed(() => {
  if (!props.folder) return { myDocuments: [], useDocuments: [], signatureDocuments: [] };

  const documents = props.folder.documents || [];
  
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

// Watch for folder changes (debug)
watch(() => props.folder, (newFolder, oldFolder) => {
  if (newFolder && oldFolder && newFolder.id === oldFolder.id) {
    const oldCount = oldFolder.documents?.length || 0;
    const newCount = newFolder.documents?.length || 0;
    if (newCount !== oldCount) {
      console.log(`📁 FolderDetailsModal: Folder "${newFolder.name}" updated! Documents: ${oldCount} → ${newCount}`);
    }
  }
}, { deep: true });

// Methods
const handleClose = () => {
  emit('close');
};

const handleAddDocuments = () => {
  emit('add-documents', props.folder);
};

const handleRemoveDocument = (documentId) => {
  emit('remove-document', documentId);
};

/**
 * Handle document click - for viewing documents
 */
const handleDocumentClick = (document) => {
  emit('view-document', document);
};

/**
 * Handle use document click - for using document templates
 */
const handleUseDocument = (documentId) => {
  // Find the document by ID
  const document = props.folder.documents.find(doc => doc.id === documentId);
  if (document) {
    emit('use-document', document);
  }
};

/**
 * Handle remove document from card - triggered by card's internal menu option
 */
const handleRemoveDocumentFromCard = (document) => {
  emit('remove-document', document.id);
};
</script> 