<template>
  <div v-if="isOpen" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
    <div class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
      <!-- Header - Fixed at top -->
      <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6 rounded-t-lg flex-shrink-0">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start space-x-3 flex-1 min-w-0">
            <div class="p-2 bg-white bg-opacity-20 rounded-lg flex-shrink-0">
              <DocumentIcon class="w-6 h-6 text-white" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold text-white">
                Administrar Asociaciones de Documentos
              </h3>
              <p class="text-blue-100 text-sm truncate">
                {{ document.title }}
              </p>
              <p class="text-blue-200 text-xs mt-1">
                {{ filterFullySigned ? 'Solo documentos firmados disponibles para asociar' : 'Solo documentos completados de tu propiedad' }}
              </p>
            </div>
          </div>
          <button
            @click="closeModal"
            class="text-white hover:text-blue-200 transition-colors p-3 hover:bg-white hover:bg-opacity-10 rounded-lg flex-shrink-0"
          >
            <XMarkIcon class="w-6 h-6" />
          </button>
        </div>
      </div>

      <!-- Tab Navigation - Fixed below header -->
      <div class="border-b border-gray-200 bg-gray-50 flex-shrink-0">
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

      <!-- Tab Content - Scrollable area -->
      <div class="p-6 overflow-y-auto flex-1">
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
            :readonly="isReadOnlyEffective"
            :defer-save="deferSave"
            :pending-relationships="pendingRelationships"
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
            :readonly="readonly"
            :defer-save="deferSave"
            :pending-relationships="pendingRelationships"
            :available-documents="availableDocuments"
            @unrelate-document="handleUnrelateDocument"
            @refresh="loadData"
          />
        </div>
      </div>

      <!-- Footer - Fixed at bottom -->
      <div class="bg-gray-50 px-6 py-4 border-t border-gray-200 rounded-b-lg flex-shrink-0">
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
  },
  readonly: {
    type: Boolean,
    default: false
  },
  filterFullySigned: {
    type: Boolean,
    default: false
  },
  forceRelateTab: {
    type: Boolean,
    default: false
  },
  // When true (formalize mode), relationships are not persisted immediately.
  // Instead, the IDs in pendingRelationships are sent back to the parent,
  // and only created in backend once the document is formalized.
  deferSave: {
    type: Boolean,
    default: false
  },
  // Array of document IDs selected as pending relationships.
  pendingRelationships: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'refresh', 'update-pending', 'update-count'])

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
} = useDocumentRelationships(props.document?.id, { filterFullySigned: props.filterFullySigned })

// Derived state: whether the source document allows editing relationships
const isSourceCompleted = computed(() => props.document?.state === 'Completed')
const isReadOnlyEffective = computed(() => {
  // In formalize mode (forceRelateTab), we allow managing associations even if
  // the local copy of the document is not in state 'Completed'. The backend
  // will still enforce that only final-state documents participate.
  if (props.forceRelateTab) {
    return props.readonly
  }
  return props.readonly || !isSourceCompleted.value
})

// Tab management
const activeTab = ref(isReadOnlyEffective.value ? 'related' : 'relate')

/**
 * Determine the default tab based on whether the document has relationships
 * For "Mis Documentos" context, if there are relationships, show "Documentos Relacionados" first
 * Otherwise, show "Relacionar Documentos" first
 * If forceRelateTab is true (formalize mode), always show "Relacionar Documentos"
 */
const getDefaultTab = () => {
  // If forceRelateTab is true (formalize mode), always show 'relate'
  if (props.forceRelateTab) {
    return 'relate'
  }
  
  // If readonly, always show 'related'
  if (isReadOnlyEffective.value) {
    return 'related'
  }
  
  // If document has at least one relationship, default to 'related' tab
  // Otherwise, default to 'relate' tab
  return (relatedDocuments.value?.length > 0) ? 'related' : 'relate'
}

const tabs = computed(() => {
  // In defer mode (formalize), the related count should reflect
  // how many pending relationships the user has selected so far.
  const relatedCount = props.deferSave
    ? (props.pendingRelationships?.length || 0)
    : (relatedDocuments.value?.length || 0)

  const baseTabs = [
    {
      id: 'related',
      label: 'Documentos Relacionados',
      icon: DocumentDuplicateIcon,
      count: relatedCount
    },
    {
      id: 'relate',
      label: 'Relacionar Documentos',
      icon: LinkIcon,
      count: availableDocuments.value?.length
    }
  ]

  // If forceRelateTab is true (formalize mode), show both tabs
  // The default tab will be set to 'relate' by getDefaultTab()
  // Note: We show both tabs so user can see documents they've already related
  if (props.forceRelateTab) {
    return baseTabs
  }

  // In effective readonly mode (explicit or because document is not Completed),
  // only show the "Documentos Relacionados" tab
  if (isReadOnlyEffective.value) {
    return baseTabs.filter(tab => tab.id === 'related')
  }

  return baseTabs
})

// Methods
const closeModal = () => {
  // Emit the updated count instead of forcing a full refresh
  emit('update-count', {
    documentId: props.document.id,
    count: relationships.value.length
  })
  // Backwards compatibility: still emit refresh for consumers that rely on it
  emit('refresh')
  emit('close')
}

const loadData = async () => {
  if (!props.document?.id) {
    return
  }
  
  try {
    const promises = []

    // Only load availableDocuments when the user is allowed to create relationships
    if (!isReadOnlyEffective.value) {
      // Use filterCompleted for "Mis Documentos" context, filterFullySigned for signature workflows
      const filterOptions = props.filterFullySigned 
        ? { filterFullySigned: true } 
        : { filterCompleted: true }
      promises.push(loadAvailableDocuments(filterOptions))
    }

    // Always load existing relationships metadata so that, outside of
    // defer mode, we can show real related documents.
    promises.push(loadRelatedDocuments(), loadRelationships())
    await Promise.all(promises)
    
    // After loading data, set the default tab based on relationships count
    activeTab.value = getDefaultTab()
  } catch (error) {
    await showNotification('Error al cargar los datos', 'error')
  }
}

const handleRelateDocument = async (targetDocument) => {
  try {
    // Safety guard: avoid calling the API if the document is not Completed in normal mode
    // In formalize mode (forceRelateTab), we rely on backend validation instead.
    if (!isSourceCompleted.value && !props.forceRelateTab) {
      await showNotification('Solo puedes crear asociaciones para documentos completados.', 'warning')
      return
    }

    // In defer mode (formalize), just update pending IDs in parent
    if (props.deferSave) {
      if (!props.pendingRelationships.includes(targetDocument.id)) {
        const updated = [...props.pendingRelationships, targetDocument.id]
        emit('update-pending', updated)
        await showNotification('Documento agregado a relaciones pendientes', 'success')
      }
      return
    }

    // Normal mode: create relationship immediately
    await createRelationship({
      source_document: props.document.id,
      target_document: targetDocument.id
    })
    
    await showNotification('Documentos relacionados exitosamente', 'success')
    await loadData()
    // Emit the new count for optimistic update using the actual relationships length
    emit('update-count', {
      documentId: props.document.id,
      count: relationships.value.length
    })
    // Backwards compatibility: also emit refresh
    emit('refresh')
  } catch (error) {
    console.error('Error relating document:', error)
    await showNotification('Error al relacionar los documentos', 'error')
  }
}

const handleUnrelateDocument = async (relationshipIdOrDocId) => {
  try {
    // In defer mode, relationshipIdOrDocId is actually a document ID
    if (props.deferSave) {
      const updated = props.pendingRelationships.filter(
        id => id !== relationshipIdOrDocId
      )
      emit('update-pending', updated)
      await showNotification('Documento removido de relaciones pendientes', 'success')
      return
    }

    // Normal mode: delete relationship from backend
    await deleteRelationship(relationshipIdOrDocId)
    await showNotification('Relación eliminada exitosamente', 'success')
    await loadData()
    // Emit the new count for optimistic update using the actual relationships length
    emit('update-count', {
      documentId: props.document.id,
      count: relationships.value.length
    })
    // Backwards compatibility: also emit refresh
    emit('refresh')
  } catch (error) {
    console.error('Error unrelating document:', error)
    await showNotification('Error al eliminar la relación', 'error')
  }
}


// Watch for modal open/close to load data
watch(() => props.isOpen, (newValue) => {
  if (newValue && props.document?.id) {
    // Load data first, then the tab will be set by loadData() based on relationships count
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
