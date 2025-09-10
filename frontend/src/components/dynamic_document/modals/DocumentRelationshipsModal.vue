<template>
  <div v-if="isOpen" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
    <div class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-white bg-opacity-20 rounded-lg">
              <DocumentIcon class="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-white">
                Administrar Asociaciones de Documentos
              </h3>
              <p class="text-blue-100 text-sm">
                {{ document.title }}
              </p>
              <p class="text-blue-200 text-xs mt-1">
                Solo documentos completados de tu propiedad
              </p>
            </div>
          </div>
          <button
            @click="closeModal"
            class="text-white hover:text-blue-200 transition-colors p-2 hover:bg-white hover:bg-opacity-10 rounded-lg"
          >
            <XMarkIcon class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="border-b border-gray-200 bg-gray-50">
        <nav class="flex">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'py-3 px-6 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            <div class="flex items-center space-x-2">
              <component :is="tab.icon" class="w-4 h-4" />
              <span>{{ tab.label }}</span>
              <span
                v-if="tab.count !== undefined"
                :class="[
                  'px-2 py-0.5 rounded-full text-xs',
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-200 text-gray-600'
                ]"
              >
                {{ tab.count }}
              </span>
            </div>
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div class="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
        <!-- Loading State -->
        <div v-if="isLoading" class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span class="ml-3 text-gray-600">Cargando...</span>
        </div>

        <!-- Relacionar Documentos Tab -->
        <div v-else-if="activeTab === 'relate'" class="space-y-6">
          <RelateDocumentsTab
            :document="document"
            :available-documents="availableDocuments"
            :is-loading="isLoadingAvailable"
            @relate-document="handleRelateDocument"
            @refresh="loadData"
          />
        </div>

        <!-- Documentos Relacionados Tab -->
        <div v-else-if="activeTab === 'related'" class="space-y-6">
          <RelatedDocumentsTab
            :document="document"
            :related-documents="relatedDocuments"
            :relationships="relationships"
            :is-loading="isLoadingRelated"
            @unrelate-document="handleUnrelateDocument"
            @refresh="loadData"
          />
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div class="flex justify-end space-x-3">
          <button
            @click="closeModal"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<!--
DocumentRelationshipsModal

Main modal component for managing document relationships. Provides a tabbed
interface for both creating new relationships and viewing existing ones.

Features:
- Two-tab interface (relate/view relationships)
- Real-time data loading and updates
- Comprehensive error handling with user notifications
- Document count indicators in tab headers

Props:
- isOpen: Controls modal visibility
- document: The document to manage relationships for

Emits:
- close: When modal should be closed
- refresh: When parent should refresh its data
-->

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { 
  DocumentIcon, 
  XMarkIcon, 
  LinkIcon, 
  DocumentDuplicateIcon 
} from '@heroicons/vue/24/outline'
import RelateDocumentsTab from './tabs/RelateDocumentsTab.vue'
import RelatedDocumentsTab from './tabs/RelatedDocumentsTab.vue'
import { useDocumentRelationships } from '@/composables/useDocumentRelationships'
import { showNotification } from '@/shared/notification_message'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  document: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'refresh'])

// Composable for API calls
const {
  availableDocuments,
  relatedDocuments, 
  relationships,
  isLoading,
  isLoadingAvailable,
  isLoadingRelated,
  loadAvailableDocuments,
  loadRelatedDocuments,
  loadRelationships,
  createRelationship,
  deleteRelationship
} = useDocumentRelationships(props.document?.id)

// Tab management
const activeTab = ref('relate')

const tabs = computed(() => [
  {
    id: 'relate',
    label: 'Relacionar Documentos',
    icon: LinkIcon,
    count: availableDocuments.value?.length
  },
  {
    id: 'related',
    label: 'Documentos Relacionados',
    icon: DocumentDuplicateIcon,
    count: relatedDocuments.value?.length
  }
])

// Methods
const closeModal = () => {
  emit('close')
}

const loadData = async () => {
  if (!props.document?.id) return
  
  try {
    await Promise.all([
      loadAvailableDocuments(),
      loadRelatedDocuments(),
      loadRelationships()
    ])
  } catch (error) {
    console.error('Error loading data:', error)
    await showNotification('Error al cargar los datos', 'error')
  }
}

const handleRelateDocument = async (targetDocument) => {
  try {
    await createRelationship({
      source_document: props.document.id,
      target_document: targetDocument.id
    })
    
    await showNotification('Documentos relacionados exitosamente', 'success')
    await loadData()
    emit('refresh')
  } catch (error) {
    console.error('Error relating document:', error)
    await showNotification('Error al relacionar los documentos', 'error')
  }
}

const handleUnrelateDocument = async (relationshipId) => {
  try {
    await deleteRelationship(relationshipId)
    await showNotification('Relación eliminada exitosamente', 'success')
    await loadData()
    emit('refresh')
  } catch (error) {
    console.error('Error unrelating document:', error)
    await showNotification('Error al eliminar la relación', 'error')
  }
}


// Watch for modal open/close to load data
watch(() => props.isOpen, (newValue) => {
  if (newValue && props.document?.id) {
    activeTab.value = 'relate'
    loadData()
  }
})

// Load data when component mounts if modal is already open
onMounted(() => {
  if (props.isOpen && props.document?.id) {
    loadData()
  }
})
</script>
