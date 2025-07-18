<template>
  <ModalTransition v-if="folder">
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <!-- Header -->
        <div class="flex justify-between items-center p-6 border-b">
          <div class="flex items-center gap-3">
            <div 
              class="w-8 h-8 rounded-full"
              :style="{ backgroundColor: folderColor.hex }"
            ></div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{{ folder.name }}</h3>
              <p class="text-sm text-gray-600">{{ folder.documents.length }} documentos</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="handleAddDocuments"
              class="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              <PlusIcon class="w-4 h-4" />
              Agregar Documentos
            </button>
            <button @click="handleClose" class="text-gray-400 hover:text-gray-500">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
        </div>

        <!-- Documents Content -->
        <div class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div v-if="folder.documents.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- My Documents -->
            <template v-for="document in folderDocumentsByType.myDocuments" :key="`doc-${document.id}`">
              <DocumentCard
                :document="document"
                :card-type="'folder'"
                :card-context="'folder'"
                :highlighted-doc-id="null"
                :show-tags="true"
                :show-client-name="false"
                :additional-classes="'relative'"
                :document-store="documentStore"
                :user-store="userStore"
                @click="handleViewDocument"
                @preview="handleViewDocument"
                @edit="handleEditDocument"
                @refresh="handleRefresh"
                @copy="handleCopyDocument"
                @remove-from-folder="handleRemoveDocumentFromCard"
              >
                <template #additional-actions>
                  <button
                    @click.stop="handleRemoveDocument(document.id)"
                    class="absolute top-2 left-2 w-6 h-6 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors flex items-center justify-center z-10"
                    title="Quitar de carpeta"
                  >
                    <XMarkIcon class="w-4 h-4" />
                  </button>
                </template>
              </DocumentCard>
            </template>

            <!-- Use Documents (Formatos) -->
            <template v-for="document in folderDocumentsByType.useDocuments" :key="`use-${document.id}`">
              <UseDocumentCard
                :document="document"
                :show-tags="true"
                @click="handleUseDocument"
              >
                <template #additional-actions>
                  <button
                    @click.stop="handleRemoveDocument(document.id)"
                    class="absolute top-2 left-2 w-6 h-6 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors flex items-center justify-center z-10"
                    title="Quitar de carpeta"
                  >
                    <XMarkIcon class="w-4 h-4" />
                  </button>
                </template>
              </UseDocumentCard>
            </template>

            <!-- Signature Documents -->
            <template v-for="document in folderDocumentsByType.signatureDocuments" :key="`sig-${document.id}`">
              <SignatureDocumentCard
                :document="document"
                :card-type="'signatures'"
                :card-context="'folder'"
                :highlighted-doc-id="null"
                :show-tags="true"
                :document-store="documentStore"
                :user-store="userStore"
                @click="handleViewDocument"
                @preview="handleViewDocument"
                @sign="handleSignDocument"
                @refresh="handleRefresh"
              >
                <template #additional-actions>
                  <button
                    @click.stop="handleRemoveDocument(document.id)"
                    class="absolute top-2 left-2 w-6 h-6 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors flex items-center justify-center z-10"
                    title="Quitar de carpeta"
                  >
                    <XMarkIcon class="w-4 h-4" />
                  </button>
                </template>
              </SignatureDocumentCard>
            </template>
          </div>

          <!-- Empty folder state -->
          <div v-else class="text-center py-12">
            <DocumentIcon class="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">Carpeta vacía</h4>
            <p class="text-gray-600 mb-4">Agrega documentos a esta carpeta para organizarlos</p>
            <button
              @click="handleAddDocuments"
              class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              <PlusIcon class="w-5 h-5" />
              Agregar Documentos
            </button>
          </div>
        </div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { computed } from 'vue';
import { useDocumentFolderStore } from '@/stores/documentFolder';
import { useUserStore } from '@/stores/user';
import { useDynamicDocumentStore } from '@/stores/dynamicDocument';

// Icons
import { 
  PlusIcon, 
  XMarkIcon, 
  DocumentIcon 
} from '@heroicons/vue/24/outline';

// Components
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import { DocumentCard, UseDocumentCard, SignatureDocumentCard } from '@/components/dynamic_document/cards';

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
  'document-action',
  'refresh'
]);

// Stores
const folderStore = useDocumentFolderStore();
const userStore = useUserStore();
const documentStore = useDynamicDocumentStore();

// Computed
const currentUser = computed(() => userStore.currentUser);

const folderColor = computed(() => {
  if (!props.folder) return { hex: '#6B7280' };
  return folderStore.getFolderWithColor(props.folder.id)?.color || { hex: '#6B7280' };
});

// Get folder documents grouped by type
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

const handleViewDocument = (document) => {
  emit('view-document', document);
};

const handleUseDocument = (document) => {
  emit('use-document', document);
};

const handleDocumentAction = (action, document) => {
  emit('document-action', action, document);
};

// Handle document edit
const handleEditDocument = (document) => {
  emit('view-document', document); // Reutilizar el mismo evento
};

// Handle document sign
const handleSignDocument = (document) => {
  emit('document-action', 'sign', document);
};

// Handle refresh after actions
const handleRefresh = () => {
  // Force parent to refresh folder data
  emit('refresh');
};

// Handle remove document from card action
const handleRemoveDocumentFromCard = (document) => {
  handleRemoveDocument(document.id);
};

// Handle copy/duplicate document
const handleCopyDocument = (document) => {
  emit('document-action', 'copy', document);
};
</script> 