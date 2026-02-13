<template>
  <!-- Content -->
  <div v-if="document" class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
    <div class="w-full p-5 rounded-lg border-2 border-stroke bg-terciary">
      <!-- Document's name -->
      <div>
        <h1 class="text-primary text-xl font-semibold">{{ document.title }}</h1>
      </div>

      <!-- Dynamic form fields grid -->
      <div class="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div
          v-for="(variable, index) in document.variables"
          :key="index"
          :class="{
            'col-span-3': variable.field_type === 'text_area',
            'col-span-1': variable.field_type !== 'text_area',
          }"
        >
          <div class="flex items-center gap-2 mb-2">
            <label
              :for="'field-' + index"
              class="text-base font-medium text-primary"
            >
              {{ variable.name_es || variable.name_en }}
            </label>
            <div v-if="variable.tooltip" class="relative group">
              <InformationCircleIcon
                class="size-5 text-gray-400 hover:text-secondary cursor-pointer"
              />
              <div
                class="absolute hidden group-hover:block top-2 left-4 transform translate-y-[-100%] px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg"
                style="white-space: nowrap; z-index: 10"
              >
                {{ variable.tooltip }}
              </div>
            </div>
          </div>

          <!-- Text input -->
          <input
            v-if="variable.field_type === 'input'"
            type="text"
            v-model="variable.value"
            :id="'field-' + index"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-secondary"
            :class="{ 'ring-red-300': validationErrors[index] }"
            @input="validateField(variable, index)"
          />

          <!-- Text area -->
          <textarea
            v-if="variable.field_type === 'text_area'"
            v-model="variable.value"
            :id="'field-' + index"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-secondary"
            :class="{ 'ring-red-300': validationErrors[index] }"
            @input="validateField(variable, index)"
            rows="4"
          ></textarea>

          <!-- Number input with currency -->
          <div v-if="variable.field_type === 'number'" class="relative">
            <div class="relative rounded-md shadow-sm">
              <!-- Currency prefix if exists -->
              <div 
                v-if="variable.currency" 
                class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
              >
                <span class="text-gray-500 sm:text-sm font-medium">{{ variable.currency }}</span>
              </div>
              
              <!-- Number input -->
              <input
                type="text"
                v-model="variable.value"
                :id="'field-' + index"
                :class="[
                  'block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-secondary',
                  variable.currency ? 'pl-16' : 'pl-3',
                  validationErrors[index] ? 'ring-red-300' : ''
                ]"
                :placeholder="variable.currency ? '0' : 'Ingrese un valor'"
                @input="handleNumericInput(variable, index, $event)"
                @blur="formatDisplayValue(variable)"
              />
            </div>
            
            <!-- Formatted preview hint -->
            <p
              v-if="variable.value && !validationErrors[index] && getNumericValue(variable.value)"
              class="mt-1.5 text-xs text-gray-500 italic pl-1"
            >
              {{ formatNumericValueForDisplay(variable) }}
            </p>
          </div>

          <!-- Date input -->
          <input
            v-if="variable.field_type === 'date'"
            type="date"
            v-model="variable.value"
            :id="'field-' + index"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-secondary"
            :class="{ 'ring-red-300': validationErrors[index] }"
            @input="validateField(variable, index)"
          />

          <!-- Email input -->
          <input
            v-if="variable.field_type === 'email'"
            type="email"
            v-model="variable.value"
            :id="'field-' + index"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-secondary"
            :class="{ 'ring-red-300': validationErrors[index] }"
            @input="validateField(variable, index)"
          />

          <!-- Select input -->
          <select
            v-if="variable.field_type === 'select'"
            v-model="variable.value"
            :id="'field-' + index"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-secondary"
            :class="{ 'ring-red-300': validationErrors[index] }"
            @change="validateField(variable, index)"
          >
            <option value="">Seleccione una opción</option>
            <option
              v-for="option in variable.select_options"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>

          <!-- Validation error message -->
          <p v-if="validationErrors[index]" class="text-red-500 text-sm mt-1 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            {{ validationErrors[index] }}
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 pt-6 border-t border-gray-200">
        <!-- Save Progress button (only in non-formalize mode) -->
        <button
          v-if="route.params.mode === 'editor' || route.params.mode === 'creator'"
          type="button"
          class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          @click="saveDocument('Progress')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span>{{ isEditMode ? "Guardar cambios como Borrador" : "Guardar progreso" }}</span>
        </button>
        
        <!-- Complete/Formalize button -->
        <button
          type="button"
          class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg shadow-sm transition-all duration-200"
          :class="
            !allFieldsComplete || (route.params.mode === 'formalize' && selectedSigners.length === 0)
              ? 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
          "
          :disabled="!allFieldsComplete || (route.params.mode === 'formalize' && selectedSigners.length === 0)"
          @click="saveDocument(route.params.mode === 'formalize' ? 'Published' : 'Completed')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {{
              route.params.mode === 'formalize'
                ? 'Formalizar y Agregar Firmas'
                : route.params.mode === 'correction'
                  ? 'Guardar y reenviar para firma'
                  : (isEditMode ? "Completar y Generar" : "Generar")
            }}
          </span>
        </button>
        
        <!-- Cancel button -->
        <button
          @click="handleBack()"
          type="button"
          class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg shadow-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 sm:ml-auto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Cancelar</span>
        </button>
      </div>

      <!-- User Selection for Signatures (visible only when requires_signature is true) -->
      <div v-if="route.params.mode === 'formalize'" class="mt-4">
        <label class="block text-sm font-medium text-primary mb-2">
          Seleccionar usuarios que deben firmar
        </label>

        <!-- User search input -->
        <div class="relative">
          <input
            type="text"
            v-model="userSearchQuery"
            @input="searchUsers"
            placeholder="Buscar usuario por nombre o correo..."
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300"
          />

          <!-- Search results dropdown -->
          <div v-if="showUserResults && filteredUsers.length > 0" class="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
            <ul class="py-1">
              <li 
                v-for="user in filteredUsers" 
                :key="user.id"
                @click="addSigner(user)"
                class="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              >
                {{ user.first_name }} {{ user.last_name }} ({{ user.email }})
              </li>
            </ul>
          </div>
        </div>

        <!-- Selected signers list -->
        <div v-if="selectedSigners.length > 0" class="mt-4">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Firmantes seleccionados:</h4>
          <ul class="space-y-2">
            <li 
              v-for="(signer, index) in selectedSigners" 
              :key="signer.id"
              class="flex items-center justify-between p-2 bg-gray-50 rounded-md"
            >
              <div>
                <span class="font-medium">{{ index + 1 }}.</span>
                {{ signer.first_name }} {{ signer.last_name }} ({{ signer.email }})
              </div>
              <button 
                @click="removeSigner(signer)"
                class="text-red-500 hover:text-red-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </button>
            </li>
          </ul>
        </div>

        <div class="mt-6">
          <label class="block text-sm font-medium text-primary mb-1">
            Fecha límite para firmar (opcional)
          </label>
          <p class="text-xs text-gray-500 mb-2">
            Después de esta fecha, el documento pasará automáticamente al estado "Expirado" si no ha sido firmado completamente.
          </p>
          <input
            v-model="signatureDueDate"
            type="date"
            :min="minSignatureDate"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-secondary sm:text-sm sm:leading-6"
          />
        </div>

        <!-- Document Associations Management -->
        <div class="mt-6 pt-6 border-t border-gray-200">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h4 class="text-sm font-medium text-gray-700">Asociaciones de documentos</h4>
              <p class="text-xs text-gray-500 mt-1">Vincula este documento con otros documentos ya firmados</p>
            </div>
            <button
              type="button"
              @click="openAssociationsModal"
              class="inline-flex items-center px-4 py-2 border border-indigo-300 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Gestionar asociaciones
            </button>
          </div>
          <p v-if="documentAssociationsCount > 0" class="text-sm text-gray-600">
            <span class="font-semibold">{{ documentAssociationsCount }}</span> documento(s) asociado(s)
          </p>
          <p v-else class="text-sm text-gray-400">
            Sin asociaciones
          </p>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="text-center text-gray-500">
    <p>Cargando documento...</p>
  </div>

  <!-- Document Relationships Modal -->
  <teleport to="body">
    <DocumentRelationshipsModal
      v-if="showAssociationsModal && document"
      :is-open="showAssociationsModal"
      :document="document"
      :force-relate-tab="route.params.mode === 'formalize'"
      :defer-save="route.params.mode === 'formalize'"
      :pending-relationships="pendingRelationships"
      @close="closeAssociationsModal"
      @refresh="refreshAssociations"
      @update-pending="updatePendingRelationships"
    />
  </teleport>

  <!-- Global document preview modal (used by relationships modal "Ver documento" buttons) -->
  <DocumentPreviewModal
    :isVisible="showPreviewModal"
    :documentData="previewDocumentData"
    @close="showPreviewModal = false"
  />
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import { InformationCircleIcon } from "@heroicons/vue/24/outline";
import { showNotification } from "@/shared/notification_message";
import { create_request } from "@/stores/services/request_http";
import { registerUserActivity, ACTION_TYPES } from "@/stores/dashboard/activity_feed";
import DocumentRelationshipsModal from "@/components/dynamic_document/modals/DocumentRelationshipsModal.vue";
import DocumentPreviewModal from "@/components/dynamic_document/common/DocumentPreviewModal.vue";
import { showPreviewModal, previewDocumentData } from "@/shared/document_utils";
import Swal from "sweetalert2";

const route = useRoute();
const router = useRouter();
const store = useDynamicDocumentStore();
const userStore = useUserStore();

const documentBase = ref(null);
const document = ref(null);
const userSearchQuery = ref("");
const showUserResults = ref(false);
const filteredUsers = ref([]);
const selectedSigners = ref([]);
const signatureDueDate = ref("");
const validationErrors = ref([]);
const showAssociationsModal = ref(false);
const documentAssociationsCount = ref(0);
const pendingRelationships = ref([]);  // Relaciones temporales en modo formalizar

// Detect edit mode based on the presence of a document ID
const isEditMode = ref(false);

// Validation rules for different field types
const minSignatureDate = computed(() => new Date().toISOString().split("T")[0]);

const validationRules = {
  input: (value) => value && value.trim().length > 0,
  text_area: (value) => value && value.trim().length > 0,
  number: (value) => !isNaN(parseFloat(value)) && isFinite(value),
  date: (value) => {
    if (!value) return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) return false;
    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
  },
  email: (value) => {
    if (!value) return false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(value);
  },
  select: (value) => value && value.trim().length > 0
};

/**
 * Searches for users based on the search query
 */
const searchUsers = () => {
  if (userSearchQuery.value.trim() === '') {
    filteredUsers.value = [];
    showUserResults.value = false;
    return;
  }
  
  const query = userSearchQuery.value.toLowerCase();
  filteredUsers.value = userStore.users.filter(user => {
    // Avoid showing already selected users
    if (selectedSigners.value.some(selected => selected.id === user.id)) {
      return false;
    }
    
    return (
      user.email.toLowerCase().includes(query) ||
      (user.first_name && user.first_name.toLowerCase().includes(query)) ||
      (user.last_name && user.last_name.toLowerCase().includes(query))
    );
  }).slice(0, 5); // Limit to 5 results to avoid UI clutter
  
  showUserResults.value = true;
};

/**
 * Adds a user to the selected signers list
 */
const addSigner = (user) => {
  selectedSigners.value.push(user);
  userSearchQuery.value = '';
  filteredUsers.value = [];
  showUserResults.value = false;
};

/**
 * Removes a user from the selected signers list
 */
const removeSigner = (user) => {
  selectedSigners.value = selectedSigners.value.filter(s => s.id !== user.id);
};

// Hide results when input is cleared
watch(userSearchQuery, (newValue) => {
  if (newValue === '') {
    showUserResults.value = false;
  }
});

/**
 * Validate a single field
 * @param {Object} variable - The variable to validate
 * @param {number} index - The index of the variable
 */
const validateField = (variable, index) => {
  const errors = [];
  
  if (variable.value !== null && variable.value !== undefined) {
    const validateField = validationRules[variable.field_type];
    if (validateField && !validateField(variable.value)) {
      switch (variable.field_type) {
        case 'number':
          errors.push("El valor debe ser un número válido.");
          break;
        case 'date':
          errors.push("El valor debe ser una fecha válida en formato YYYY-MM-DD.");
          break;
        case 'email':
          errors.push("El valor debe ser un correo electrónico válido.");
          break;
        default:
          if (String(variable.value).trim().length === 0) {
            errors.push("El valor no puede estar vacío.");
          }
      }
    }
  }

  if (errors.length > 0) {
    validationErrors.value[index] = errors.join(" ");
  } else {
    validationErrors.value[index] = null;
  }
};

/**
 * Validate form fields before saving.
 * @returns {boolean} - Returns true if all validations pass, false otherwise.
 */
const validateForm = () => {
  validationErrors.value = [];

  let isValid = true;
  document.value?.variables.forEach((variable, index) => {
    validateField(variable, index);
    if (validationErrors.value[index]) {
      isValid = false;
    }
  });

  // Validate that at least one signer is selected if in formalize mode
  if (route.params.mode === 'formalize' && selectedSigners.value.length === 0) {
    Swal.fire({
      title: "Firmantes requeridos",
      text: "Debe seleccionar al menos un usuario para firmar el documento.",
      icon: "warning",
    });
    return false;
  }

  if (!isValid) {
    Swal.fire({
      title: "Campos incompletos",
      text: "Por favor, verifica los formatos de los campos.",
      icon: "warning",
    });
  }

  return isValid;
};

/**
 * Fetches document data based on the route parameters when the component is mounted.
 */
onMounted(async () => {
  const documentId = route.params.id;
  isEditMode.value = route.params.mode === "editor" || route.params.mode === "formalize" || route.params.mode === "correction";
  documentBase.value = await store.fetchDocumentById(documentId);

  // Ensure we have users loaded for search
  if (!userStore.users || userStore.users.length === 0) {
    await userStore.fetchUsers();
  }

  if (route.params.mode === "creator") {
    document.value = {
      title: route.params.title,
      variables: documentBase.value.variables,
      content: documentBase.value.content,
      created_by: documentBase.value.created_by,
      assigned_to: store.currentUser?.id || null,
      // Copy tags from the original document template
      tags: documentBase.value.tags || []
    };
  }

  if (route.params.mode === "editor" || route.params.mode === "formalize" || route.params.mode === "correction") {
    // Create a deep copy to avoid modifying the original document in the store
    document.value = JSON.parse(JSON.stringify(documentBase.value));
    document.value.title = route.params.title;
    
    // If we're in formalize mode, update state and load signers
    if (route.params.mode === "formalize") {
      document.value.state = "Published";
      document.value.requires_signature = true;
      
      // If document already has signers, load them
      if (document.value.signer_ids && document.value.signer_ids.length > 0) {
        const users = await userStore.getUsersByIds(document.value.signer_ids);
        selectedSigners.value = users;
      }
    }
  }
});

/**
 * Computes whether all required fields in the document are complete.
 *
 * @returns {Boolean} True if all variables have values, false otherwise.
 */
const allFieldsComplete = computed(() => {
  return document.value?.variables.every(
    (variable) => variable.value !== null && variable.value !== undefined && String(variable.value).trim().length > 0
  );
});

/**
 * Get numeric value from a formatted string (removes commas, dots, etc.)
 */
const getNumericValue = (value) => {
  if (!value) return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Format numeric value for display with thousands separators
 */
const formatNumericValueForDisplay = (variable) => {
  const numValue = getNumericValue(variable.value);
  if (numValue === null) return '';
  
  try {
    const formatted = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numValue);
    
    return variable.currency 
      ? `${variable.currency} $ ${formatted}` 
      : formatted;
  } catch (e) {
    return variable.value;
  }
};

/**
 * Handle numeric input with live formatting
 */
const handleNumericInput = (variable, index, event) => {
  const input = event.target.value;
  
  // Allow empty input
  if (!input || input.trim() === '') {
    variable.value = '';
    validateField(variable, index);
    return;
  }
  
  // Extract only numbers and decimal point
  const cleaned = input.replace(/[^0-9.]/g, '');
  
  // Prevent multiple decimal points
  const parts = cleaned.split('.');
  let sanitized = parts[0];
  if (parts.length > 1) {
    sanitized += '.' + parts.slice(1).join('');
  }
  
  // Update the value
  variable.value = sanitized;
  validateField(variable, index);
};

/**
 * Format display value when user leaves the field
 */
const formatDisplayValue = (variable) => {
  if (!variable.value) return;
  
  const numValue = getNumericValue(variable.value);
  if (numValue !== null) {
    // Normalize stored value to a plain numeric string without locale-specific separators
    variable.value = String(numValue);
  }
};

/**
 * Saves the document based on its mode (edit or create).
 *
 * @param {String} state - The state of the document (e.g., "Completed", "Draft").
 */
const saveDocument = async (state = 'Draft') => {
  if (!validateForm()) {
    return;
  }

  try {
    // Get current user ID (for clients creating documents from templates)
    const currentUser = userStore.getCurrentUser;
    const userId = currentUser?.id || store.currentUser?.id;
    
    // Determine if this is a client creating from a template
    const isClientCreatingFromTemplate = route.params.mode === 'creator' && 
                                         document.value.state === 'Published' && 
                                         !document.value.assigned_to;
    
    // For clients creating from templates, always use 'Progress' state and assign to current user
    const isFormalizeMode = route.params.mode === 'formalize';
    const isCorrectionMode = route.params.mode === 'correction';

    const finalState = isClientCreatingFromTemplate
      ? 'Progress'
      : isFormalizeMode
        ? 'PendingSignatures'
        : isCorrectionMode
          ? document.value.state
          : state;
    
    const documentData = {
      title: document.value.title,
      content: document.value.content,
      state: finalState,
      // Assign to current user if creating from template or if document doesn't have assigned_to
      assigned_to: (isClientCreatingFromTemplate || !document.value.assigned_to) && userId ? userId : document.value.assigned_to,
      variables: document.value.variables.map((variable) => {
        // For numeric fields, clean the formatted value before sending to backend
        let cleanValue = variable.value;
        if (variable.field_type === 'number' && variable.value) {
          const numValue = getNumericValue(variable.value);
          cleanValue = numValue !== null ? String(numValue) : variable.value;
        }
        
        return {
          name_en: variable.name_en,
          name_es: variable.name_es,
          tooltip: variable.tooltip || "",
          field_type: variable.field_type,
          value: cleanValue,
          select_options: variable.field_type === 'select' ? variable.select_options : null,
          summary_field: variable.summary_field || 'none',
          currency: variable.summary_field === 'value' ? (variable.currency || null) : null,
        };
      }),
      // Add signature data if in formalize mode
      requires_signature: route.params.mode === 'formalize' || route.params.mode === 'correction',
      signature_due_date: route.params.mode === 'formalize' ? (signatureDueDate.value || null) : (document.value.signature_due_date || null),
      signers: route.params.mode === 'formalize' ? (() => {
        // Get selected signer IDs
        const signerIds = selectedSigners.value.map(user => user.id);
        // Add current user as signer if not already included (for corporate/client roles)
        const currentUserId = userStore.currentUser?.id;
        if (currentUserId && !signerIds.includes(currentUserId)) {
          signerIds.push(currentUserId);
        }
        return signerIds;
      })() : [],
      // Include tags if they exist (for client documents created from templates)
      tag_ids: document.value.tags ? document.value.tags.map(tag => tag.id) : []
    };

    let documentId = null;
    
    // In formalize mode, always create a new document
    if (route.params.mode === 'formalize') {
      const response = await store.createDocument(documentData);
      if (response && response.id) {
        documentId = response.id;
        
        // Create pending relationships for the new document
        if (pendingRelationships.value.length > 0) {
          try {
            const { documentRelationshipsActions } = await import('@/stores/dynamic_document/relationships');
            let successCount = 0;
            let failCount = 0;
            
            for (const targetDocId of pendingRelationships.value) {
              try {
                await documentRelationshipsActions.createDocumentRelationship({
                  source_document: documentId,
                  target_document: targetDocId,
                  allow_pending_signatures: true
                });
                successCount++;
              } catch (relError) {
                console.error(`Error creating relationship with document ${targetDocId}:`, relError);
                failCount++;
              }
            }
            
            if (successCount > 0) {
              console.log(`Successfully created ${successCount} relationship(s)`);
            }
            if (failCount > 0) {
              console.warn(`Failed to create ${failCount} relationship(s)`);
              await showNotification(
                `Documento formalizado, pero ${failCount} asociación(es) no pudieron crearse`,
                'warning'
              );
            }
          } catch (relError) {
            console.error('Error importing relationships module:', relError);
            await showNotification(
              'Documento formalizado, pero las asociaciones no pudieron crearse',
              'warning'
            );
          }
        }
      }
    }
    // For other modes, update or create as needed
    else if (isEditMode.value && document.value.id) {
      await store.updateDocument(document.value.id, documentData);
      documentId = document.value.id;

      // In correction mode, after updating the rejected document, reopen signatures
      if (route.params.mode === 'correction' && documentId) {
        try {
          const reopenUrl = `dynamic-documents/${documentId}/reopen-signatures/`;
          const response = await create_request(reopenUrl, {});
          if (!response || (response.status !== 200 && response.status !== 201)) {
            await showNotification('Error al reabrir el documento para firma.', 'error');
            return;
          }
          // Refresh documents to reflect new PendingSignatures state
          await store.init(true);

          // Register user activity for correction and resend to signatures
          try {
            await registerUserActivity(
              ACTION_TYPES.UPDATE,
              `Corregiste y reenviaste el documento "${document.value.title}" para firma`
            );
          } catch (activityError) {
            console.warn('No se pudo registrar la actividad de corrección y reenvío:', activityError);
          }
        } catch (error) {
          console.error('Error reopening document for signatures:', error);
          await showNotification('Error al reabrir el documento para firma.', 'error');
          return;
        }
      }
    } else {
      const response = await store.createDocument(documentData);
      if (response && response.id) {
        documentId = response.id;
        // Refresh the store to include the new document in the list
        await store.init(true);
      }
    }
    
    // Set lastUpdatedDocumentId to highlight the document in the list
    if (documentId) {
      localStorage.setItem('lastUpdatedDocumentId', documentId.toString());
      store.lastUpdatedDocumentId = documentId;
    }
    
    await showNotification(
      route.params.mode === 'formalize'
        ? "Documento formalizado y listo para firmas"
        : route.params.mode === 'correction'
          ? "Documento corregido y reenviado para firmas"
          : state === "Draft"
            ? "Documento guardado como borrador"
            : "Documento publicado exitosamente",
      "success"
    );
    
    // Redirect to dashboard after a short delay
    setTimeout(() => {
      // If in formalize mode, redirect to pending signatures tab
      if (route.params.mode === 'formalize' || route.params.mode === 'correction') {
        const currentUser = userStore.currentUser;
        if (currentUser?.role === 'lawyer') {
          // For lawyers, use query param to set the tab
          router.push({ path: '/dynamic_document_dashboard', query: { lawyerTab: 'pending-signatures' } });
        } else {
          // For clients/corporate, use query param to set the tab
          router.push({ path: '/dynamic_document_dashboard', query: { tab: 'pending-signatures' } });
        }
      } else {
        // For client/basic/corporate flows, always return to "Mis Documentos" tab
        router.push({ path: '/dynamic_document_dashboard', query: { tab: 'my-documents' } });
      }
    }, 300);
  } catch (error) {
    console.error('Error saving document:', error);
    await showNotification('Error al guardar documento', 'error');
  }
};

/**
 * Handles navigation back to the document dashboard.
 */
const handleBack = () => {
  router.push("/dynamic_document_dashboard");
};

/**
 * Opens the associations modal
 */
const openAssociationsModal = () => {
  showAssociationsModal.value = true;
};

/**
 * Closes the associations modal
 */
const closeAssociationsModal = () => {
  showAssociationsModal.value = false;
};

/**
 * Updates pending relationships in formalize mode
 */
const updatePendingRelationships = (relationships) => {
  pendingRelationships.value = relationships;
  // Update count for display
  documentAssociationsCount.value = relationships.length;
};

/**
 * Refreshes associations count after changes
 */
const refreshAssociations = async () => {
  // In formalize mode, just update the count from pending relationships
  if (route.params.mode === 'formalize') {
    documentAssociationsCount.value = pendingRelationships.value.length;
    return;
  }
  
  if (document.value?.id) {
    try {
      // Fetch updated relationships count using the relationships store
      const { documentRelationshipsActions } = await import('@/stores/dynamic_document/relationships');
      const relatedDocs = await documentRelationshipsActions.getRelatedDocuments(document.value.id);
      documentAssociationsCount.value = relatedDocs?.length || 0;
    } catch (error) {
      console.error('Error refreshing associations:', error);
    }
  }
};
</script>
