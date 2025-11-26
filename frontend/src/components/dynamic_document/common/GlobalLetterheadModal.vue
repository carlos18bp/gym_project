<template>
  <ModalTransition v-show="isVisible">
    <div class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Modal header -->
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-gray-800">Gestión de Membrete Global para PDF</h2>
        <p class="text-sm text-gray-500 mt-1">
          La imagen de membrete se usará por defecto solo al generar documentos en PDF.
          Para documentos Word, se utiliza la plantilla .docx configurada más abajo.
        </p>
        <button 
          @click="close" 
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
        >
          <XMarkIcon class="h-6 w-6" />
        </button>
      </div>
      
      <!-- Modal body -->
      <div class="p-6 overflow-y-auto flex-grow">
        <!-- Loading state -->
        <div v-if="loading" class="text-center py-10">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p class="mt-4 text-gray-500">{{ loadingMessage }}</p>
        </div>
        
        <!-- Content when not loading -->
        <div v-else class="space-y-6">
          <!-- Current letterhead preview -->
          <div v-if="currentImageUrl" class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900">Membrete de imagen para PDF actual</h3>
            <div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <img 
                :src="currentImageUrl" 
                alt="Membrete de imagen para PDF actual"
                class="max-w-full h-auto max-h-64 mx-auto shadow-sm"
                @error="handleImageError"
              />
              <div class="mt-4 flex justify-center space-x-3">
                <button
                  @click="downloadImage"
                  class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <ArrowDownTrayIcon class="h-4 w-4 mr-2" />
                  Descargar
                </button>
                <button
                  @click="confirmDelete"
                  :disabled="deleting"
                  class="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  <TrashIcon class="h-4 w-4 mr-2" />
                  {{ deleting ? 'Eliminando...' : 'Eliminar' }}
                </button>
              </div>
            </div>
          </div>
          
          <!-- No letterhead message -->
          <div v-else class="text-center py-8">
            <DocumentIcon class="mx-auto h-12 w-12 text-gray-400" />
            <h3 class="mt-2 text-sm font-medium text-gray-900">Sin Membrete para PDF</h3>
            <p class="mt-1 text-sm text-gray-500">
              No tienes una imagen de membrete global configurada para los documentos PDF.
            </p>
            <p class="mt-1 text-xs text-gray-400">
              Este membrete de imagen se aplicará solo a los PDF que no tengan un membrete específico.
            </p>
          </div>
          
          <!-- Upload section -->
          <div class="space-y-4">
            <h3 class="text-lg font-medium text-gray-900">
              {{ currentImageUrl ? 'Reemplazar Membrete de imagen para PDF' : 'Subir Membrete de imagen para PDF' }}
            </h3>
            
            <!-- File upload area (PNG for PDF) -->
            <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                ref="fileInput"
                type="file"
                accept=".png"
                @change="handleFileSelect"
                class="hidden"
              />
              
              <div v-if="!selectedFile">
                <PhotoIcon class="mx-auto h-12 w-12 text-gray-400" />
                <div class="mt-4">
                  <button
                    @click="$refs.fileInput.click()"
                    class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Seleccionar Imagen PNG para PDF
                  </button>
                  <button
                    @click="showSpecifications = !showSpecifications"
                    class="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <InformationCircleIcon class="h-4 w-4 mr-2" />
                    {{ showSpecifications ? 'Ocultar' : 'Ver' }} Especificaciones
                  </button>
                </div>
                <p class="mt-2 text-sm text-gray-500">
                  Solo archivos PNG, máximo 10MB. Se usa únicamente para los PDF.
                </p>
                <p class="text-xs text-gray-400 mt-1">
                  Dimensiones ideales: 612 × 612 píxeles (8.5:11 Carta)
                </p>
              </div>
              
              <div v-else class="space-y-4">
                <div class="flex items-center justify-center space-x-2 text-sm text-gray-600">
                  <CheckCircleIcon class="h-5 w-5 text-green-500" />
                  <span>{{ selectedFile.name }}</span>
                  <span class="text-gray-400">({{ formatFileSize(selectedFile.size) }})</span>
                </div>
                
                <!-- File preview -->
                <div v-if="previewUrl" class="mt-4">
                  <img 
                    :src="previewUrl" 
                    alt="Vista previa"
                    class="max-w-full h-auto max-h-32 mx-auto border border-gray-200 rounded"
                  />
                </div>
                
                <div class="flex justify-center space-x-3">
                  <button
                    @click="clearSelection"
                    class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    @click="uploadFile"
                    :disabled="uploading"
                    class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    <CloudArrowUpIcon v-if="!uploading" class="h-4 w-4 mr-2" />
                    <div v-else class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {{ uploading ? 'Subiendo...' : 'Subir Imagen para PDF' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Word template upload section -->
          <div class="space-y-4 border-t border-gray-200 pt-6">
            <h3 class="text-lg font-medium text-gray-900">Plantilla Word para documentos (.docx)</h3>
            <p class="text-sm text-gray-500">
              Esta plantilla se usará al descargar documentos en Word. Debe ser un archivo .docx con tu membrete
              configurado (header, footer o watermark). El contenido del documento se añadirá sobre esa plantilla.
            </p>

            <!-- Current template info -->
            <div class="border border-gray-200 rounded-lg p-4 bg-gray-50" v-if="hasWordTemplate">
              <div class="text-sm text-gray-700">
                <div class="font-medium">Plantilla actual:</div>
                <div class="mt-1 break-words">
                  <span class="font-mono break-all">{{ currentWordTemplateName || 'plantilla_word.docx' }}</span>
                  <span v-if="currentWordTemplateSize" class="text-gray-400 ml-2">({{ formatFileSize(currentWordTemplateSize) }})</span>
                </div>
              </div>
              <div class="mt-3 flex flex-wrap gap-3">
                <button
                  v-if="currentWordTemplateUrl"
                  @click="downloadWordTemplate"
                  class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <ArrowDownTrayIcon class="h-4 w-4 mr-2" />
                  Descargar
                </button>
                <button
                  @click="confirmDeleteWordTemplate"
                  :disabled="deletingWordTemplate"
                  class="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  <TrashIcon class="h-4 w-4 mr-2" />
                  {{ deletingWordTemplate ? 'Eliminando...' : 'Eliminar' }}
                </button>
              </div>
            </div>
            <div v-else class="text-sm text-gray-500">
              No tienes una plantilla Word configurada. Puedes subir un archivo .docx con tu membrete.
            </div>

            <!-- Template upload area -->
            <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                ref="wordTemplateInput"
                type="file"
                accept=".docx"
                @change="handleWordTemplateSelect"
                class="hidden"
              />

              <div v-if="!selectedWordTemplate">
                <DocumentIcon class="mx-auto h-12 w-12 text-gray-400" />
                <div class="mt-4">
                  <button
                    @click="$refs.wordTemplateInput.click()"
                    class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Seleccionar Plantilla .docx (Word)
                  </button>
                </div>
                <p class="mt-2 text-sm text-gray-500">
                  Solo archivos .docx, máximo 10MB.
                </p>
              </div>

              <div v-else class="space-y-4">
                <div class="flex items-center justify-center space-x-2 text-sm text-gray-600">
                  <CheckCircleIcon class="h-5 w-5 text-green-500" />
                  <span>{{ selectedWordTemplate.name }}</span>
                  <span class="text-gray-400">({{ formatFileSize(selectedWordTemplate.size) }})</span>
                </div>

                <div class="flex justify-center space-x-3">
                  <button
                    @click="clearWordTemplateSelection"
                    class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    @click="uploadWordTemplate"
                    :disabled="uploadingWordTemplate"
                    class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    <CloudArrowUpIcon v-if="!uploadingWordTemplate" class="h-4 w-4 mr-2" />
                    <div v-else class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {{ uploadingWordTemplate ? 'Subiendo...' : 'Subir Plantilla' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Specifications Panel -->
          <div v-if="showSpecifications" class="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-6">
            <div class="flex items-center space-x-2">
              <InformationCircleIcon class="h-6 w-6 text-blue-600" />
              <h3 class="text-lg font-semibold text-blue-900">Especificaciones del Membrete para PDF</h3>
            </div>
            
            <!-- Priority Info -->
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 class="font-medium text-yellow-800 mb-2">🔄 Prioridad de Membrete</h4>
              <div class="text-sm text-yellow-700 space-y-1">
                <div><strong>1º Prioridad:</strong> Membrete específico del documento</div>
                <div><strong>2º Prioridad:</strong> Membrete global de imagen para PDF del usuario (este)</div>
                <div><strong>3º Prioridad:</strong> Sin membrete</div>
              </div>
            </div>
            
            <!-- Dimensions -->
            <div class="space-y-3">
              <h4 class="font-medium text-gray-900">📐 Dimensiones Exactas</h4>
              <div class="bg-white rounded-lg p-4 border border-blue-200">
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="font-medium text-gray-700">Ancho:</span>
                    <span class="ml-2 text-blue-600 font-mono">612 píxeles</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-700">Alto:</span>
                    <span class="ml-2 text-blue-600 font-mono">612 píxeles</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-700">Proporción:</span>
                    <span class="ml-2 text-blue-600">8.5:11 (Carta)</span>
                  </div>
                  <div>
                    <span class="font-medium text-gray-700">Tolerancia:</span>
                    <span class="ml-2 text-orange-600">±10%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Layout Guide -->
            <div class="space-y-3">
              <h4 class="font-medium text-gray-900">🎨 Distribución Recomendada</h4>
              <div class="bg-white rounded-lg p-4 border border-blue-200">
                <div class="space-y-4">
                  <!-- Visual Layout -->
                  <div class="mx-auto w-40 h-44 border-2 border-gray-300 rounded bg-gradient-to-b from-blue-100 via-yellow-50 to-green-100 relative text-xs">
                    <!-- Header Zone -->
                    <div class="absolute top-0 left-0 right-0 h-12 bg-blue-200 bg-opacity-70 border-b border-blue-300 flex items-center justify-center text-blue-800 font-medium">
                      HEADER ZONE
                    </div>
                    <div class="absolute top-10 left-1 text-blue-700 text-[10px]">120-150px</div>
                    
                    <!-- Body Zone -->
                    <div class="absolute top-12 left-0 right-0 bottom-12 bg-yellow-100 bg-opacity-50 border-y border-yellow-300 flex items-center justify-center text-yellow-800 font-medium">
                      <div class="text-center">
                        <div>BODY ZONE</div>
                        <div class="text-[10px] mt-1">⚠️ ZONA CRÍTICA</div>
                      </div>
                    </div>
                    <div class="absolute top-20 left-1 text-yellow-700 text-[10px]">300-400px</div>
                    
                    <!-- Footer Zone -->
                    <div class="absolute bottom-0 left-0 right-0 h-12 bg-green-200 bg-opacity-70 border-t border-green-300 flex items-center justify-center text-green-800 font-medium">
                      FOOTER ZONE
                    </div>
                    <div class="absolute bottom-10 left-1 text-green-700 text-[10px]">80-120px</div>
                  </div>
                  
                  <!-- Zone Descriptions -->
                  <div class="space-y-3 text-sm">
                    <div class="flex items-start space-x-3">
                      <div class="w-4 h-4 bg-blue-200 border border-blue-300 rounded mt-0.5 flex-shrink-0"></div>
                      <div>
                        <span class="font-medium text-blue-800">Header (Superior):</span>
                        <span class="text-gray-600 ml-1">Logos, nombre de empresa. Puede tener mayor intensidad visual.</span>
                      </div>
                    </div>
                    <div class="flex items-start space-x-3">
                      <div class="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded mt-0.5 flex-shrink-0"></div>
                      <div>
                        <span class="font-medium text-yellow-800">Body (Centro):</span>
                        <span class="text-gray-600 ml-1">Mantén semi-transparente. El texto del documento se superpone aquí.</span>
                      </div>
                    </div>
                    <div class="flex items-start space-x-3">
                      <div class="w-4 h-4 bg-green-200 border border-green-300 rounded mt-0.5 flex-shrink-0"></div>
                      <div>
                        <span class="font-medium text-green-800">Footer (Inferior):</span>
                        <span class="text-gray-600 ml-1">Direcciones, teléfonos, emails, información de contacto.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Technical Details -->
            <div class="space-y-3">
              <h4 class="font-medium text-gray-900">🔧 Consideraciones Técnicas</h4>
              <div class="bg-white rounded-lg p-4 border border-blue-200">
                <div class="space-y-2 text-sm text-gray-700">
                  <div class="flex items-start space-x-2">
                    <span class="text-blue-600 font-medium">•</span>
                    <span><strong>Posicionamiento:</strong> La imagen se centra automáticamente en el documento</span>
                  </div>
                  <div class="flex items-start space-x-2">
                    <span class="text-blue-600 font-medium">•</span>
                    <span><strong>Transparencia:</strong> Usa PNG con canal alpha para efectos de transparencia</span>
                  </div>
                  <div class="flex items-start space-x-2">
                    <span class="text-blue-600 font-medium">•</span>
                    <span><strong>Márgenes:</strong> Deja 30-50px de margen en los lados para seguridad</span>
                  </div>
                  <div class="flex items-start space-x-2">
                    <span class="text-blue-600 font-medium">•</span>
                    <span><strong>Resolución:</strong> 72-150 DPI es suficiente para documentos digitales</span>
                  </div>
                  <div class="flex items-start space-x-2">
                    <span class="text-orange-600 font-medium">⚠️</span>
                    <span><strong>Zona crítica:</strong> Evita elementos gráficos densos en el centro (300-400px de altura)</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Quick Tips -->
            <div class="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <h4 class="font-medium text-green-800 mb-2">💡 Tips de Diseño Rápido</h4>
              <div class="text-sm text-green-700 space-y-1">
                <div>• Si solo tienes header, ubícalo en los primeros 120-150px</div>
                <div>• El resto de la imagen debe ser transparente o blanco</div>
                <div>• Para footer, usa los últimos 80-120px</div>
                <div>• El texto se superpone en toda la imagen, mantén el centro claro</div>
              </div>
            </div>
          </div>
          
          <!-- Warnings/Messages -->
          <div v-if="warnings.length > 0" class="space-y-2">
            <div 
              v-for="(warning, index) in warnings" 
              :key="index"
              class="bg-yellow-50 border border-yellow-200 rounded-md p-3"
            >
              <div class="flex">
                <ExclamationTriangleIcon class="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                <p class="text-sm text-yellow-700">{{ warning }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ModalTransition>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useDynamicDocumentStore } from '@/stores/dynamic_document';
import { showConfirmationAlert } from '@/shared/confirmation_alert';
import ModalTransition from '@/components/layouts/animations/ModalTransition.vue';
import {
  XMarkIcon,
  DocumentIcon,
  PhotoIcon,
  CloudArrowUpIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline';

// Define props
const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  }
});

// Define emits
const emit = defineEmits(['close', 'uploaded', 'deleted']);

// Watch for isVisible changes
watch(() => props.isVisible, (newValue) => {
  // Handle visibility changes
});

// Store
const store = useDynamicDocumentStore();

// Reactive data
const loading = ref(false);
const loadingMessage = ref('');
const uploading = ref(false);
const deleting = ref(false);
const selectedFile = ref(null);
const previewUrl = ref(null);
const currentImageUrl = ref(null);
const warnings = ref([]);
const fileInput = ref(null);
const showSpecifications = ref(false);
const hasAttemptedLoad = ref(false);

// Word template reactive data
const selectedWordTemplate = ref(null);
const hasWordTemplate = ref(false);
const currentWordTemplateUrl = ref(null);
const currentWordTemplateName = ref('');
const currentWordTemplateSize = ref(null);
const uploadingWordTemplate = ref(false);
const deletingWordTemplate = ref(false);
const wordTemplateInput = ref(null);

// Methods
const close = () => {
  clearSelection();
  emit('close');
};

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  if (!file.type.includes('png')) {
    alert('Solo se permiten archivos PNG');
    return;
  }
  
  // Validate file size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    alert('El archivo no puede ser mayor a 10MB');
    return;
  }
  
  selectedFile.value = file;
  warnings.value = [];
  
  // Create preview and validate dimensions
  const reader = new FileReader();
  reader.onload = (e) => {
    previewUrl.value = e.target.result;
    
    // Create image to get dimensions
    const img = new Image();
    img.onload = () => {
      validateImageDimensions(img.width, img.height);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

const validateImageDimensions = (width, height) => {
  const idealWidth = 612;
  const idealHeight = 612;
  const tolerance = 0.1; // 10% tolerance
  
  // Calculate proportion
  const imageRatio = width / height;
  const idealRatio = idealWidth / idealHeight;
  const ratioDiff = Math.abs(imageRatio - idealRatio) / idealRatio;
  
  // Check if dimensions are exactly ideal
  if (width === idealWidth && height === idealHeight) {
    warnings.value.push('✅ Dimensiones perfectas: 612 × 612 píxeles');
    return;
  }
  
  // Check if proportions are within tolerance
  if (ratioDiff <= tolerance) {
    warnings.value.push(`ℹ️ Buenas proporciones detectadas: ${width} × ${height} píxeles (${imageRatio.toFixed(3)})`);
    if (width !== idealWidth || height !== idealHeight) {
      warnings.value.push('💡 Para mejores resultados, usa exactamente 612 × 612 píxeles');
    }
  } else {
    warnings.value.push(`⚠️ Proporciones no ideales: ${width} × ${height} píxeles (${imageRatio.toFixed(3)})`);
    warnings.value.push(`🎯 Proporciones recomendadas: ${idealRatio.toFixed(3)} (8.5:11)`);
    warnings.value.push('📐 Considera redimensionar tu imagen a 612 × 612 píxeles');
  }
  
  // Additional warnings based on dimensions
  if (width < 300 || height < 300) {
    warnings.value.push('⚠️ Imagen muy pequeña - puede verse pixelada en documentos');
  }
  
  if (width > 1200 || height > 1600) {
    warnings.value.push('ℹ️ Imagen muy grande - se redimensionará automáticamente');
  }
};

const clearSelection = () => {
  selectedFile.value = null;
  previewUrl.value = null;
  warnings.value = [];
  showSpecifications.value = false;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const uploadFile = async () => {
  if (!selectedFile.value) return;
  
  uploading.value = true;
  warnings.value = [];
  
  try {
    const response = await store.uploadGlobalLetterheadImage(selectedFile.value);
    
    // Handle warnings from backend
    if (response.data?.warnings && response.data.warnings.length > 0) {
      warnings.value = response.data.warnings;
    }
    
    // Reset load flag so we fetch the new image
    hasAttemptedLoad.value = false;
    
    // Refresh current image
    await loadCurrentImage();
    
    // Clear selection
    clearSelection();
    
    emit('uploaded', response.data);
  } catch (error) {
    console.error('Error uploading global letterhead:', error);
    alert('Error al subir la imagen. Por favor intenta nuevamente.');
  } finally {
    uploading.value = false;
  }
};

const loadCurrentImage = async () => {
  // Don't attempt to load if we already know there's no image
  // This prevents unnecessary 404 requests
  if (currentImageUrl.value === null && hasAttemptedLoad.value) {
    return;
  }
  
  hasAttemptedLoad.value = true;
  
  try {
    const response = await store.getGlobalLetterheadImage();
    if (response.data) {
      currentImageUrl.value = URL.createObjectURL(response.data);
    }
  } catch (error) {
    // Image probably doesn't exist, which is fine
    currentImageUrl.value = null;
  }
};

const confirmDelete = async () => {
  const confirmed = await showConfirmationAlert(
    '¿Estás seguro de que deseas eliminar la imagen de membrete global?'
  );
  if (!confirmed) return;
  deleteImage();
};

const deleteImage = async () => {
  deleting.value = true;
  
  try {
    await store.deleteGlobalLetterheadImage();
    
    // Clear current image
    if (currentImageUrl.value) {
      URL.revokeObjectURL(currentImageUrl.value);
    }
    currentImageUrl.value = null;
    
    // Reset load flag since image was deleted
    hasAttemptedLoad.value = true; // Keep as true to prevent trying to load deleted image
    
    emit('deleted');
  } catch (error) {
    console.error('Error deleting global letterhead:', error);
    alert('Error al eliminar la imagen. Por favor intenta nuevamente.');
  } finally {
    deleting.value = false;
  }
};

// Word template helpers
const handleWordTemplateSelect = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.name.toLowerCase().endsWith('.docx')) {
    alert('Solo se permiten archivos .docx para la plantilla Word');
    return;
  }

  // Validate file size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    alert('El archivo de plantilla no puede ser mayor a 10MB');
    return;
  }

  selectedWordTemplate.value = file;
};

const clearWordTemplateSelection = () => {
  selectedWordTemplate.value = null;
  if (wordTemplateInput.value) {
    wordTemplateInput.value.value = '';
  }
};

const uploadWordTemplate = async () => {
  if (!selectedWordTemplate.value) return;

  uploadingWordTemplate.value = true;

  try {
    const response = await store.uploadGlobalLetterheadWordTemplate(selectedWordTemplate.value);

    const info = response.data?.template_info;
    hasWordTemplate.value = true;
    currentWordTemplateName.value = info?.filename || selectedWordTemplate.value.name;
    currentWordTemplateSize.value = info?.size_bytes || selectedWordTemplate.value.size;

    // Reload blob for download
    await loadCurrentWordTemplate();

    clearWordTemplateSelection();
  } catch (error) {
    console.error('Error uploading global Word template:', error);
    alert('Error al subir la plantilla Word. Por favor intenta nuevamente.');
  } finally {
    uploadingWordTemplate.value = false;
  }
};

const loadCurrentWordTemplate = async () => {
  try {
    const response = await store.getGlobalLetterheadWordTemplate('blob');

    if (response && response.data) {
      hasWordTemplate.value = true;

      // Create blob URL for download
      if (currentWordTemplateUrl.value) {
        URL.revokeObjectURL(currentWordTemplateUrl.value);
      }
      currentWordTemplateUrl.value = URL.createObjectURL(response.data);

      // Try to extract filename from headers
      const disposition = response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'];
      let filename = 'plantilla_word.docx';
      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/i);
        if (match && match[1]) {
          filename = match[1];
        }
      }
      currentWordTemplateName.value = filename;
      currentWordTemplateSize.value = response.data.size || null;
    }
  } catch (error) {
    if (error.response?.status === 404) {
      hasWordTemplate.value = false;
      if (currentWordTemplateUrl.value) {
        URL.revokeObjectURL(currentWordTemplateUrl.value);
      }
      currentWordTemplateUrl.value = null;
      currentWordTemplateName.value = '';
      currentWordTemplateSize.value = null;
    } else {
      console.error('Error loading global Word template:', error);
    }
  }
};

const confirmDeleteWordTemplate = async () => {
  const confirmed = await showConfirmationAlert(
    '¿Estás seguro de que deseas eliminar la plantilla Word de membrete global?'
  );
  if (!confirmed) return;
  deleteWordTemplate();
};

const deleteWordTemplate = async () => {
  deletingWordTemplate.value = true;

  try {
    await store.deleteGlobalLetterheadWordTemplate();

    if (currentWordTemplateUrl.value) {
      URL.revokeObjectURL(currentWordTemplateUrl.value);
    }
    currentWordTemplateUrl.value = null;
    currentWordTemplateName.value = '';
    currentWordTemplateSize.value = null;
    hasWordTemplate.value = false;
  } catch (error) {
    console.error('Error deleting global Word template:', error);
    alert('Error al eliminar la plantilla Word. Por favor intenta nuevamente.');
  } finally {
    deletingWordTemplate.value = false;
  }
};

const downloadWordTemplate = () => {
  if (currentWordTemplateUrl.value) {
    const a = document.createElement('a');
    a.href = currentWordTemplateUrl.value;
    a.download = currentWordTemplateName.value || 'membrete-word.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

const downloadImage = () => {
  if (currentImageUrl.value) {
    const a = document.createElement('a');
    a.href = currentImageUrl.value;
    a.download = `membrete-global.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

const handleImageError = () => {
  currentImageUrl.value = null;
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Watchers
watch(() => props.isVisible, (newValue) => {
  if (newValue) {
    loadCurrentImage();
    loadCurrentWordTemplate();
  }
});

// Cleanup on unmount
const cleanup = () => {
  if (currentImageUrl.value) {
    URL.revokeObjectURL(currentImageUrl.value);
  }
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
   if (currentWordTemplateUrl.value) {
     URL.revokeObjectURL(currentWordTemplateUrl.value);
   }
};

// Load image when component mounts if modal is visible
onMounted(() => {
  if (props.isVisible) {
    loadCurrentImage();
  }
});

// Cleanup when component unmounts
import { onUnmounted } from 'vue';
onUnmounted(cleanup);
</script>

<style scoped>
/* Add any custom styles if needed */
</style>

