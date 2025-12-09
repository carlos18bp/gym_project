<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h4 class="text-lg font-semibold text-gray-900">Documentos Relacionados</h4>
      <p class="text-sm text-gray-600 mt-1">
        Documentos asociados con "{{ document.title }}"
      </p>
      <p class="text-xs text-blue-600 mt-1">
        Solo se muestran documentos completados que te pertenecen
      </p>
    </div>

    <!-- Search -->
    <div class="bg-gray-50 p-4 rounded-lg">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar en documentos relacionados..."
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-3 text-gray-600">Cargando documentos relacionados...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredRelatedDocuments.length === 0" class="text-center py-12">
      <DocumentDuplicateIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900">
        {{ relatedDocuments.length === 0 ? 'No hay documentos relacionados' : 'No se encontraron documentos' }}
      </h3>
      <p class="mt-1 text-sm text-gray-500">
        {{ relatedDocuments.length === 0 
          ? 'Este documento aún no tiene documentos relacionados. Utiliza la pestaña "Relacionar Documentos" para crear asociaciones.' 
          : 'Intenta ajustar tu búsqueda para encontrar documentos relacionados.' 
        }}
      </p>
    </div>

    <!-- Related Documents List -->
    <div v-else class="space-y-4">
      <div class="grid grid-cols-1 gap-4">
        <div
          v-for="doc in filteredRelatedDocuments"
          :key="doc.id"
          class="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
        >
          <div class="flex items-start justify-between">
            <!-- Document Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-3">
                <div class="flex-shrink-0">
                  <div :class="[
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    getStateColor(doc.state)
                  ]">
                    <DocumentTextIcon class="w-5 h-5 text-white" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <h5 class="text-sm font-medium text-gray-900 truncate">
                    {{ doc.title }}
                  </h5>
                  <div class="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                    <span class="inline-flex items-center">
                      <span :class="[
                        'w-2 h-2 rounded-full mr-1.5',
                        getStateDotColor(doc.state)
                      ]"></span>
                      {{ getStateLabel(doc.state) }}
                    </span>
                    <span v-if="doc.created_at">
                      {{ formatDate(doc.created_at) }}
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Relationship Info -->
              <div class="mt-3">
                <div class="flex items-center space-x-2">
                  <span v-if="doc.isPending" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    <LinkIcon class="w-3 h-3 mr-1" />
                    Pendiente (se creará al formalizar)
                  </span>
                  <span v-else class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <LinkIcon class="w-3 h-3 mr-1" />
                    Relacionado
                  </span>
                </div>
                
                <!-- Created By Info -->
                <div v-if="getRelationshipInfo(doc.id)?.created_by" class="mt-2 text-xs text-gray-500">
                  Relacionado por {{ getRelationshipInfo(doc.id).created_by }} 
                  el {{ formatDate(getRelationshipInfo(doc.id).created_at) }}
                </div>
              </div>

              <!-- Content Preview (with variables resolved for final states) -->
              <div v-if="doc.content" class="mt-3 text-sm text-gray-600 line-clamp-2">
                {{ getProcessedSnippet(doc) }}
              </div>

              <!-- Tags -->
              <div v-if="doc.tags && doc.tags.length > 0" class="mt-3 flex flex-wrap gap-1">
                <span
                  v-for="tag in doc.tags"
                  :key="tag.id"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                >
                  {{ tag.name }}
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex-shrink-0 ml-4 flex flex-col space-y-2">
              <button
                type="button"
                class="inline-flex items-center justify-center px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                @click.stop="openPreviewModal(doc)"
              >
                Ver documento
              </button>
              <!-- Remove Relationship Button -->
              <button
                v-if="!readonly"
                @click="handleUnrelateDocument(doc)"
                :disabled="isUnrelating"
                class="inline-flex items-center justify-center px-3 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <TrashIcon v-if="!isUnrelating" class="w-4 h-4 mr-2" />
                <div v-else class="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                {{ isUnrelating ? 'Eliminando...' : 'Desrelacionar' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  DocumentDuplicateIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon, 
  LinkIcon,
  ArrowPathIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'
import { openPreviewModal, getProcessedDocumentContent } from '@/shared/document_utils'

const props = defineProps({
  document: {
    type: Object,
    required: true
  },
  relatedDocuments: {
    type: Array,
    default: () => []
  },
  relationships: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  readonly: {
    type: Boolean,
    default: false
  },
  deferSave: {
    type: Boolean,
    default: false
  },
  pendingRelationships: {
    type: Array,
    default: () => []
  },
  availableDocuments: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['unrelate-document'])

// Reactive state
const searchQuery = ref('')
const isUnrelating = ref(false)

// Computed properties
const filteredRelatedDocuments = computed(() => {
  let allDocuments = []
  
  // In defer mode (formalize), show pending relationships as temporary documents
  if (props.deferSave && props.pendingRelationships.length > 0) {
    // Get the actual document objects from availableDocuments based on pending IDs
    const pendingDocs = props.availableDocuments.filter(doc => 
      props.pendingRelationships.includes(doc.id)
    ).map(doc => ({
      ...doc,
      isPending: true  // Mark as pending for visual distinction
    }))
    allDocuments = [...pendingDocs]
  } else {
    // Normal mode: show actual related documents from backend
    allDocuments = props.relatedDocuments || []
  }
  
  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    allDocuments = allDocuments.filter(doc => 
      doc.title?.toLowerCase().includes(query) ||
      doc.content?.toLowerCase().includes(query)
    )
  }
  
  return allDocuments
})

// Methods
const getRelationshipInfo = (documentId) => {
  const relationship = props.relationships.find(rel => 
    rel.source_document === documentId || rel.target_document === documentId
  )
  
  if (!relationship) return null
  
  return {
    id: relationship.id,
    created_by: relationship.created_by_name,
    created_at: relationship.created_at
  }
}

const handleUnrelateDocument = async (targetDocument) => {
  // In defer mode, emit the document ID directly
  if (props.deferSave) {
    emit('unrelate-document', targetDocument.id)
    return
  }
  
  // Normal mode: get relationship ID and emit it
  const relationshipInfo = getRelationshipInfo(targetDocument.id)
  if (!relationshipInfo) return
  
  isUnrelating.value = true
  try {
    await emit('unrelate-document', relationshipInfo.id)
  } finally {
    isUnrelating.value = false
  }
}


const getStateColor = (state) => {
  const colors = {
    'Draft': 'bg-gray-500',
    'Published': 'bg-green-500',
    'Progress': 'bg-blue-500',
    'Completed': 'bg-purple-500',
    'FullySigned': 'bg-emerald-500',
    'PendingSignatures': 'bg-yellow-500'
  }
  return colors[state] || 'bg-gray-500'
}

const getStateDotColor = (state) => {
  const colors = {
    'Draft': 'bg-gray-400',
    'Published': 'bg-green-400',
    'Progress': 'bg-blue-400',
    'Completed': 'bg-purple-400',
    'FullySigned': 'bg-emerald-400',
    'PendingSignatures': 'bg-yellow-400'
  }
  return colors[state] || 'bg-gray-400'
}

const getStateLabel = (state) => {
  const labels = {
    'Draft': 'Borrador',
    'Published': 'Publicado',
    'Progress': 'En Progreso',
    'Completed': 'Completado',
    'FullySigned': 'Firmado',
    'PendingSignatures': 'Pendiente de Firma'
  }
  return labels[state] || state
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  try {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
}

const stripHtml = (html) => {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

// Returns a short, plain-text preview with variables already replaced
// for completed / signed documents.
const getProcessedSnippet = (doc) => {
  const content = getProcessedDocumentContent(doc)
  return stripHtml(content)
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
