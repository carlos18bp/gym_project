<template>
  <div class="p-4 bg-white rounded-lg border border-stroke">
    <div class="flex flex-col space-y-4">
      <!-- Back button -->
      <div class="self-start mb-2">
        <button 
          @click="cancel" 
          class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver
        </button>
      </div>
      
      <div class="relative">
        <canvas 
          ref="signatureCanvas" 
          class="w-full h-64 border border-stroke rounded-lg bg-white touch-none"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="stopDrawing"
        ></canvas>
        
        <div v-if="!hasDrawn" class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p class="text-gray-400">Dibuja tu firma aquí</p>
        </div>
        
        <button 
          @click="clearCanvas" 
          class="absolute -top-2 -right-2 bg-red-100 rounded-full p-1 text-red-500 shadow-sm hover:bg-red-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div v-if="hasDrawn" class="flex justify-center">
        <button 
          type="button" 
          class="inline-flex justify-center rounded-md border border-transparent px-4 py-2 bg-secondary text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary"
          @click="saveSignature"
          :disabled="isSubmitting"
        >
          <svg v-if="isSubmitting" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isSubmitting ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineEmits, defineProps } from 'vue';

/**
 * Component for drawing electronic signature
 * @emits {save} - When signature is saved
 * @emits {cancel} - When operation is cancelled
 */
const emit = defineEmits(['save', 'cancel']);

const props = defineProps({
  isSubmitting: {
    type: Boolean,
    default: false
  }
});

const signatureCanvas = ref(null);
const isDrawing = ref(false);
const hasDrawn = ref(false);
let context = null;

/**
 * Initialize canvas and drawing context on component mount
 */
onMounted(() => {
  const canvas = signatureCanvas.value;
  context = canvas.getContext('2d');
  
  // Set canvas dimensions correctly to avoid distortion
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  
  // Set up canvas context
  context.strokeStyle = '#141E30'; // primary color
  context.lineWidth = 2;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  
  clearCanvas();
});

/**
 * Start drawing on mouse down
 * @param {MouseEvent} event - Mouse down event
 */
const startDrawing = (event) => {
  isDrawing.value = true;
  hasDrawn.value = true;
  
  const { offsetX, offsetY } = event;
  context.beginPath();
  context.moveTo(offsetX, offsetY);
};

/**
 * Draw on the canvas as mouse moves
 * @param {MouseEvent} event - Mouse move event
 */
const draw = (event) => {
  if (!isDrawing.value) return;
  
  const { offsetX, offsetY } = event;
  context.lineTo(offsetX, offsetY);
  context.stroke();
};

/**
 * Handle touch start for mobile devices
 * @param {TouchEvent} event - Touch start event
 */
const handleTouchStart = (event) => {
  event.preventDefault();
  const touch = event.touches[0];
  const canvas = signatureCanvas.value;
  const rect = canvas.getBoundingClientRect();
  
  const offsetX = touch.clientX - rect.left;
  const offsetY = touch.clientY - rect.top;
  
  isDrawing.value = true;
  hasDrawn.value = true;
  
  context.beginPath();
  context.moveTo(offsetX, offsetY);
};

/**
 * Handle touch move for mobile devices
 * @param {TouchEvent} event - Touch move event
 */
const handleTouchMove = (event) => {
  event.preventDefault();
  if (!isDrawing.value) return;
  
  const touch = event.touches[0];
  const canvas = signatureCanvas.value;
  const rect = canvas.getBoundingClientRect();
  
  const offsetX = touch.clientX - rect.left;
  const offsetY = touch.clientY - rect.top;
  
  context.lineTo(offsetX, offsetY);
  context.stroke();
};

/**
 * Stop drawing on mouse up or leave
 */
const stopDrawing = () => {
  isDrawing.value = false;
};

/**
 * Clear the canvas
 */
const clearCanvas = () => {
  if (!context) return;
  
  context.fillStyle = 'white';
  context.fillRect(0, 0, signatureCanvas.value.width, signatureCanvas.value.height);
  hasDrawn.value = false;
};

/**
 * Save the drawn signature as a PNG image
 */
const saveSignature = () => {
  if (!hasDrawn.value) return;
  
  const signatureImage = signatureCanvas.value.toDataURL('image/png');
  
  // Record traceability data
  const traceabilityData = {
    date: new Date().toISOString(),
    ip: '0.0.0.0', // In a real implementation, this would come from backend
    method: 'draw'
  };
  
  emit('save', {
    signatureImage,
    traceabilityData
  });
};

/**
 * Cancel the operation
 */
const cancel = () => {
  emit('cancel');
};
</script> 