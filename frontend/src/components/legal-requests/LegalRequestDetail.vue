<template>
  <div class="legal-request-detail max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12">
      <ExclamationTriangleIcon class="mx-auto h-16 w-16 text-red-400" />
      <h3 class="mt-4 text-lg font-medium text-gray-900">Error al cargar la solicitud</h3>
      <p class="mt-2 text-gray-600">{{ error }}</p>
      <button
        @click="fetchRequest"
        class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        Reintentar
      </button>
    </div>

    <!-- Request detail content -->
    <div v-else-if="request" class="space-y-6">
      <!-- Header -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="flex items-center space-x-3 mb-2">
              <h1 class="text-2xl font-bold text-gray-900">
                {{ request.request_number }}
              </h1>
              <StatusBadge :status="request.status" />
            </div>
            <p class="text-gray-600">
              Solicitud de {{ request.first_name }} {{ request.last_name }}
            </p>
          </div>

          <!-- Actions (only for lawyers) -->
          <div v-if="isLawyer" class="flex space-x-3 mt-4 lg:mt-0">
            <button
              @click="showStatusModal = true"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Cambiar Estado
            </button>
            <button
              @click="showDeleteModal = true"
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <!-- Request information -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Información de la Solicitud</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Client info -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 mb-3">Datos del Cliente</h3>
            <div class="space-y-2">
              <div>
                <span class="text-sm font-medium text-gray-600">Nombre:</span>
                <span class="ml-2 text-sm text-gray-900">{{ request.first_name }} {{ request.last_name }}</span>
              </div>
              <div>
                <span class="text-sm font-medium text-gray-600">Email:</span>
                <span class="ml-2 text-sm text-gray-900">{{ request.email }}</span>
              </div>
              <div>
                <span class="text-sm font-medium text-gray-600">Fecha:</span>
                <span class="ml-2 text-sm text-gray-900">{{ formatDate(request.created_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Request details -->
          <div>
            <h3 class="text-sm font-medium text-gray-700 mb-3">Detalles de la Solicitud</h3>
            <div class="space-y-2">
              <div>
                <span class="text-sm font-medium text-gray-600">Tipo:</span>
                <span class="ml-2 text-sm text-gray-900">{{ request.request_type?.name }}</span>
              </div>
              <div>
                <span class="text-sm font-medium text-gray-600">Disciplina:</span>
                <span class="ml-2 text-sm text-gray-900">{{ request.discipline?.name }}</span>
              </div>
              <div>
                <span class="text-sm font-medium text-gray-600">Estado:</span>
                <span class="ml-2"><StatusBadge :status="request.status" /></span>
              </div>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="mt-6">
          <h3 class="text-sm font-medium text-gray-700 mb-3">Descripción</h3>
          <p class="text-sm text-gray-900 whitespace-pre-wrap">{{ request.description }}</p>
        </div>
      </div>

      <!-- Files section -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">Archivos Adjuntos</h2>
          <!-- Add files button for clients only -->
          <button
            v-if="canAddFiles"
            @click="showAddFilesModal = true"
            class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Agregar archivos
          </button>
        </div>
        
        <div v-if="request.files && request.files.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="file in request.files"
            :key="file.id"
            class="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <DocumentIcon class="h-8 w-8 text-gray-400 mr-3" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">
                {{ getFileName(file.file) }}
              </p>
              <p class="text-xs text-gray-500">
                {{ formatDate(file.created_at) }}
              </p>
            </div>
            <button
              @click="downloadFile(file.id)"
              class="ml-3 text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50 transition-colors"
              title="Descargar archivo"
            >
              <ArrowDownTrayIcon class="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div v-else class="text-center py-8 text-gray-500">
          <DocumentIcon class="mx-auto h-12 w-12 text-gray-300" />
          <p class="mt-2">No hay archivos adjuntos</p>
          <p v-if="canAddFiles" class="text-sm mt-1">
            Haz clic en "Agregar archivos" para subir documentos
          </p>
        </div>
      </div>

      <!-- Responses section -->
      <ResponseThread
        :request-id="request.id"
        :responses="request.responses || []"
        :user-role="userRole"
        @response-added="handleResponseAdded"
      />
    </div>

    <!-- Modals -->
    <StatusUpdateModal
      v-if="showStatusModal"
      :request="request"
      @close="showStatusModal = false"
      @updated="handleStatusUpdated"
    />

    <DeleteConfirmModal
      v-if="showDeleteModal"
      :request="request"
      @close="showDeleteModal = false"
      @deleted="handleDeleted"
    />

    <AddFilesModal
      v-if="showAddFilesModal"
      :request="request"
      @close="showAddFilesModal = false"
      @files-added="handleFilesAdded"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  ExclamationTriangleIcon, 
  DocumentIcon, 
  ArrowDownTrayIcon 
} from '@heroicons/vue/24/outline'
import StatusBadge from './StatusBadge.vue'
import ResponseThread from './ResponseThread.vue'
import StatusUpdateModal from './lawyer-only/StatusUpdateModal.vue'
import DeleteConfirmModal from './lawyer-only/DeleteConfirmModal.vue'
import AddFilesModal from './client-only/AddFilesModal.vue'
import { useLegalRequestsStore } from '@/stores/legal/legal_requests_management.js'
import { useAuthStore } from '@/stores/auth/auth.js'
import { useUserStore } from '@/stores/auth/user.js'

// Router
const route = useRoute()
const router = useRouter()

// Stores
const legalRequestsStore = useLegalRequestsStore()
const authStore = useAuthStore()
const userStore = useUserStore()

// Props
const props = defineProps({
  requestId: {
    type: [String, Number],
    default: null
  },
  userRole: {
    type: String,
    default: null
  }
})

// Reactive data
const request = ref(null)
const loading = ref(false)
const error = ref(null)
const showStatusModal = ref(false)
const showDeleteModal = ref(false)
const showAddFilesModal = ref(false)
const currentUser = reactive({})

// Computed
const userRole = computed(() => 
  props.userRole || currentUser.role || 'client'
)

const requestId = computed(() => 
  props.requestId || route.params.id
)

const isLawyer = computed(() => {
  const userRole = currentUser.role || authStore.user?.role
  return userRole === 'lawyer'
})

const canAddFiles = computed(() => {
  // Fallback to authStore if currentUser is not loaded yet
  const userRole = currentUser.role || authStore.user?.role
  const userId = currentUser.id || authStore.user?.id
  
  // Only clients can add files
  const isClient = userRole === 'client'
  
  // Cannot add files to closed requests
  const isNotClosed = request.value?.status !== 'CLOSED'
  
  // Must be the owner of the request (additional security check)
  const isOwner = request.value?.user === userId
  
  return isClient && isNotClosed && isOwner
})

// Methods
const fetchRequest = async () => {
  if (!requestId.value) return

  loading.value = true
  error.value = null

  try {
    const requestData = await legalRequestsStore.fetchRequestDetail(requestId.value)
    request.value = requestData
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getFileName = (filePath) => {
  return filePath.split('/').pop() || 'Archivo'
}

const handleStatusUpdated = (updatedRequest) => {
  request.value = updatedRequest
  showStatusModal.value = false
}

const handleDeleted = () => {
  showDeleteModal.value = false
  router.push({ name: 'legal_requests_list' })
}

const scrollToLatestMessage = () => {
  // First try to scroll to the last message specifically
  const messages = document.querySelectorAll('.response-message')
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1]
    lastMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  } else {
    // Fallback: scroll to the response thread container
    const responseThread = document.querySelector('.response-thread')
    if (responseThread) {
      responseThread.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }
}

const handleResponseAdded = async (newResponse) => {
  // The store already handles adding the response to currentRequest.responses
  // We just need to scroll to the new message and sync the local state
  
  // Sync with store's currentRequest if it exists
  if (legalRequestsStore.currentRequest && legalRequestsStore.currentRequest.id === request.value.id) {
    request.value.responses = legalRequestsStore.currentRequest.responses
  }
  
  // Scroll to the new message after a short delay
  setTimeout(() => {
    scrollToLatestMessage()
  }, 150)
}

const handleFilesAdded = async () => {
  // Refresh the request data to show new files
  await fetchRequest()
  showAddFilesModal.value = false
}

const downloadFile = async (fileId) => {
  try {
    const response = await legalRequestsStore.downloadFile(requestId.value, fileId)
    
    // Create a blob from the response
    const blob = new Blob([response.data], { 
      type: response.headers['content-type'] || 'application/octet-stream' 
    })
    
    // Get filename from content-disposition header or use default
    let filename = 'archivo'
    const contentDisposition = response.headers['content-disposition']
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
      if (filenameMatch) {
        filename = filenameMatch[1]
      }
    }
    
    // Create download link
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    
    // Cleanup
    window.URL.revokeObjectURL(url)
    document.body.removeChild(link)
    
  } catch (error) {
    console.error('Error downloading file:', error)
    // You could show a notification here
    alert('Error al descargar el archivo. Inténtalo de nuevo.')
  }
}

// Lifecycle
onMounted(async () => {
  try {
    // Initialize currentUser following SlideBar pattern
    await userStore.init()
    Object.assign(currentUser, userStore.userById(authStore.userAuth.id))
    
    // Fetch request data
    await fetchRequest()
    
  } catch (error) {
    console.error('❌ Error initializing LegalRequestDetail:', error)
  }
})
</script>
