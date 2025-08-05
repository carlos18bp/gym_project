<!-- ReportsWidget.vue -->
<template>
  <div class="overflow-y-auto max-h-[170px] scrollbar-thin">
    <div class="py-3">
      <div class="flex flex-col space-y-4">
        <!-- Report Type -->
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
        
        <!-- Date Range (Optional) -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="startDate" class="block text-sm font-medium text-gray-700 mb-1">Fecha Inicial (Opcional)</label>
            <input 
              type="date" 
              id="startDate" 
              v-model="startDate" 
              placeholder="dd/mm/yyyy"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label for="endDate" class="block text-sm font-medium text-gray-700 mb-1">Fecha Final (Opcional)</label>
            <input 
              type="date" 
              id="endDate" 
              v-model="endDate" 
              placeholder="dd/mm/yyyy"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <!-- Date Required Message -->
        <div v-if="startDate && !endDate || !startDate && endDate" class="text-red-500 text-xs">
          Si proporcionas una fecha, debes proporcionar ambas fechas.
        </div>
        
        <!-- Loading indicator -->
        <div v-if="isGenerating" class="flex justify-center">
          <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"></div>
          <span class="ml-2 text-sm text-gray-600">Generando reporte...</span>
        </div>
        
        <!-- Action Button -->
        <div class="flex pt-2">
          <button 
            @click="generateReport" 
            class="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 text-sm font-medium transition duration-150"
            :disabled="!isFormValid || isGenerating"
          >
            <span v-if="!isGenerating">Generar y Descargar Reporte</span>
            <span v-else>Procesando...</span>
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
 * 2. Optionally define a date range (start date and end date)
 * 3. Generate and download the report in Excel format
 */
import { ref, computed, onMounted } from 'vue';
import { useReportsStore } from '@/stores/dashboard/reports';

const props = defineProps({
  /**
   * Current user object
   */
  user: {
    type: Object,
    required: true
  }
});

// Get reports store
const reportsStore = useReportsStore();

// State variables
const selectedReportType = ref('');
const startDate = ref('');
const endDate = ref('');
const isGenerating = ref(false);

// Available report types
const reportTypes = [
  { value: 'active_processes', label: 'Procesos Activos' },
  { value: 'processes_by_lawyer', label: 'Procesos por Abogado' },
  { value: 'processes_by_client', label: 'Procesos por Cliente' },
  { value: 'process_stages', label: 'Etapas de Procesos' },
  { value: 'registered_users', label: 'Usuarios Registrados' },
  { value: 'user_activity', label: 'Actividad de Usuarios' },
  { value: 'lawyers_workload', label: 'Carga de Trabajo de Abogados' },
  { value: 'documents_by_state', label: 'Documentos por Estado' },
  { value: 'legal_requests', label: 'Solicitudes Recibidas' },
  { value: 'requests_by_type', label: 'Solicitudes por Tipo y Disciplina' }
];

// Form validation - only report type is required 
// But if one date is provided, both must be provided and valid
const isFormValid = computed(() => {
  // Report type is always required
  if (!selectedReportType.value) return false;
  
  // If both dates are empty, that's fine (use all data)
  if (!startDate.value && !endDate.value) return true;
  
  // If one date is provided but not the other, form is invalid
  if ((startDate.value && !endDate.value) || (!startDate.value && endDate.value)) return false;
  
  // If both dates are provided, ensure start date is before or equal to end date
  return new Date(startDate.value) <= new Date(endDate.value);
});

// Helper to format date as YYYY-MM-DD
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Generate and download the Excel report
const generateReport = async () => {
  if (!isFormValid.value) return;
  
  isGenerating.value = true;
  
  try {
    const reportData = {
      reportType: selectedReportType.value,
      startDate: startDate.value,
      endDate: endDate.value
    };
    
    await reportsStore.generateExcelReport(reportData);
    
  } catch (error) {
    console.error('Error generating report:', error);
    alert('Error al generar el reporte');
  } finally {
    isGenerating.value = false;
  }
};
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