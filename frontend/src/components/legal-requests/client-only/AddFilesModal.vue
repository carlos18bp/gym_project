<template>
  <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click="$emit('close')">
    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white" @click.stop>
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">
          Agregar Archivos
        </h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-500"
        >
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>

      <!-- Content -->
      <div class="space-y-4">
        <p class="text-sm text-gray-600">
          Selecciona archivos adicionales para agregar a tu solicitud {{ request.request_number }}.
        </p>

        <!-- File input area -->
        <div
          @drop="handleDrop"
          @dragover.prevent
          @dragenter.prevent
          class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
          :class="{ 'border-indigo-400 bg-indigo-50': isDragging }"
        >
          <DocumentPlusIcon class="mx-auto h-12 w-12 text-gray-400" />
          <div class="mt-4">
            <label for="file-upload" class="cursor-pointer">
              <span class="mt-2 block text-sm font-medium text-gray-900">
                Arrastra archivos aquí o 
                <span class="text-indigo-600 hover:text-indigo-500">selecciona archivos</span>
              </span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                multiple
                class="sr-only"
                @change="handleFileSelect"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
            </label>
            <p class="mt-1 text-xs text-gray-500">
              PDF, DOC, DOCX, JPG, PNG hasta 10MB cada uno
            </p>
          </div>
        </div>

        <!-- Selected files -->
        <div v-if="selectedFiles.length > 0" class="space-y-2">
          <h4 class="text-sm font-medium text-gray-900">Archivos seleccionados:</h4>
          <div class="max-h-32 overflow-y-auto space-y-1">
            <div
              v-for="(file, index) in selectedFiles"
              :key="index"
              class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
            >
              <span class="truncate flex-1">{{ file.name }}</span>
              <button
                @click="removeFile(index)"
                class="ml-2 text-red-500 hover:text-red-700"
              >
                <XMarkIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end space-x-3 mt-6">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          :disabled="uploading"
        >
          Cancelar
        </button>
        <button
          @click="uploadFiles"
          :disabled="selectedFiles.length === 0 || uploading"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ uploading ? 'Subiendo...' : `Subir ${selectedFiles.length} archivo${selectedFiles.length !== 1 ? 's' : ''}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { XMarkIcon, DocumentPlusIcon } from '@heroicons/vue/24/outline'
import { useLegalRequestsStore } from '@/stores/legal/legal_requests_management.js'

// Props
const props = defineProps({
  request: {
    type: Object,
    required: true
  }
})

// Emits
const emit = defineEmits(['close', 'files-added'])

// Store
const legalRequestsStore = useLegalRequestsStore()

// Reactive data
const selectedFiles = ref([])
const uploading = ref(false)
const isDragging = ref(false)

// Methods
const handleFileSelect = (event) => {
  const files = Array.from(event.target.files)
  addFiles(files)
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragging.value = false
  const files = Array.from(event.dataTransfer.files)
  addFiles(files)
}

const addFiles = (files) => {
  // Filter for allowed file types and size
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/jpg', 'image/png']
  const maxSize = 10 * 1024 * 1024 // 10MB

  files.forEach(file => {
    if (!allowedTypes.includes(file.type)) {
      alert(`El archivo "${file.name}" no es un tipo permitido.`)
      return
    }
    
    if (file.size > maxSize) {
      alert(`El archivo "${file.name}" es demasiado grande. Máximo 10MB.`)
      return
    }

    // Check if file already selected
    if (selectedFiles.value.some(f => f.name === file.name && f.size === file.size)) {
      return
    }

    selectedFiles.value.push(file)
  })
}

const removeFile = (index) => {
  selectedFiles.value.splice(index, 1)
}

const uploadFiles = async () => {
  if (selectedFiles.value.length === 0) return

  uploading.value = true

  try {
    const result = await legalRequestsStore.addFilesToRequest(props.request.id, selectedFiles.value)
    
    if (result.success) {   
      // Clear selected files
      selectedFiles.value = []
      
      // Emit success event
      emit('files-added')
    }
  } catch (error) {
    console.error('Error uploading files:', error)
    alert('Error al subir archivos. Por favor, inténtalo de nuevo.')
  } finally {
    uploading.value = false
  }
}
</script>
