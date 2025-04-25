<!-- ReportsWidget.vue -->
<template>
  <div class="overflow-y-auto max-h-[170px] scrollbar-thin">
    <div class="py-3">
      <div class="flex flex-col space-y-4">
        <!-- Tipo de Reporte -->
        <div>
          <label for="reportType" class="block text-sm font-medium text-gray-700 mb-1">Tipo de Reporte</label>
          <select 
            id="reportType" 
            v-model="selectedReportType"
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="" disabled>Selecciona un tipo de reporte</option>
            <option v-for="(report, index) in reportTypes" :key="index" :value="report.value">
              {{ report.label }}
            </option>
          </select>
        </div>
        
        <!-- Rango de Fechas -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">Fecha Inicial</label>
            <input 
              type="date" 
              id="startDate" 
              v-model="startDate" 
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label for="endDate" class="block text-sm font-medium text-gray-700 mb-1">Fecha Final</label>
            <input 
              type="date" 
              id="endDate" 
              v-model="endDate" 
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <!-- Botones de Acción -->
        <div class="flex space-x-3 pt-2">
          <button 
            @click="generateReport" 
            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 text-sm font-medium transition duration-150"
            :disabled="!isFormValid"
          >
            Generar Reporte
          </button>
          <button 
            @click="previewReport"
            class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md py-2 text-sm font-medium transition duration-150"
            :disabled="!isFormValid"
          >
            Previsualizar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Reports Widget Component
 * 
 * This component allows users to:
 * 1. Select a report type from a predefined list
 * 2. Define a date range (start date and end date)
 * 3. Generate or preview the report
 */
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
  /**
   * Current user object
   */
  user: {
    type: Object,
    required: true
  }
});

// State variables
const selectedReportType = ref('');
const startDate = ref('');
const endDate = ref('');
const isGenerating = ref(false);

// Available report types
const reportTypes = [
  { value: 'activity', label: 'Actividad Semanal' },
  { value: 'performance', label: 'Rendimiento' },
  { value: 'billing', label: 'Facturación' },
  { value: 'clients', label: 'Clientes' },
  { value: 'cases', label: 'Casos' }
];

// Form validation
const isFormValid = computed(() => {
  return (
    selectedReportType.value && 
    startDate.value && 
    endDate.value && 
    new Date(startDate.value) <= new Date(endDate.value)
  );
});

// Set default dates (current month)
const setDefaultDates = () => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  startDate.value = formatDate(firstDay);
  endDate.value = formatDate(lastDay);
};

// Helper to format date as YYYY-MM-DD
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Generate the report
const generateReport = async () => {
  if (!isFormValid.value) return;
  
  isGenerating.value = true;
  
  try {
    console.log('Generando reporte:', {
      tipo: selectedReportType.value,
      fechaInicio: startDate.value,
      fechaFin: endDate.value,
      usuario: props.user?.id
    });
    
    // Aquí iría la llamada a la API para generar el reporte
    // Por ahora solo simulamos el proceso
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simular descarga
    alert('Reporte generado con éxito. Inicia descarga...');
    
  } catch (error) {
    console.error('Error al generar el reporte:', error);
    alert('Error al generar el reporte');
  } finally {
    isGenerating.value = false;
  }
};

// Preview the report
const previewReport = () => {
  if (!isFormValid.value) return;
  
  console.log('Previsualizando reporte:', {
    tipo: selectedReportType.value,
    fechaInicio: startDate.value,
    fechaFin: endDate.value,
    usuario: props.user?.id
  });
  
  // Aquí se implementaría la funcionalidad para previsualizar el reporte
  alert('Funcionalidad de previsualización en desarrollo');
};

// Initialize component data
onMounted(() => {
  console.log('ReportsWidget mounted, user:', props.user);
  setDefaultDates();
});
</script>

<style scoped>
/* Custom scrollbar styles */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Disabled button styles */
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style> 