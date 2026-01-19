<template>
  <div class="pb-10 px-4 sm:px-6 lg:px-8 lg:pt-10">
    <div class="w-full p-5 rounded-lg border-2 border-stroke bg-terciary">
      <h1 class="text-primary text-xl font-semibold">
        {{ store.selectedDocument?.title }}
      </h1>

      <!-- Display form fields for variables -->
      <div class="mt-4 space-y-4">
        <div
          v-for="(variable, index) in store.selectedDocument?.variables || []"
          :key="index"
          class="grid grid-cols-12 gap-4 items-center"
        >
          <h2 class="text-primary text-lg font-semibold col-span-12">
            {{ variable.name_en }}
          </h2>

          <!-- Display name in Spanish input -->
          <div class="col-span-4">
            <label
              :for="'name_es_' + index"
              class="block text-sm font-medium leading-6 text-primary"
            >
              Nombre en pantalla <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              v-model="variable.name_es"
              :id="'name_es_' + index"
              class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300"
              required
            />
            <p v-if="validationErrors[index]" class="text-red-500 text-sm mt-1">
              {{ validationErrors[index] }}
            </p>
          </div>

          <!-- Display tooltip input -->
          <div class="col-span-4">
            <label
              for="tooltip"
              class="block text-sm font-medium leading-6 text-primary"
            >
              Tooltip
            </label>
            <input
              type="text"
              v-model="variable.tooltip"
              id="tooltip"
              class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300"
              placeholder="Opcional"
            />
          </div>

          <!-- Input type selector -->
          <div class="col-span-4">
            <label
              for="field_type"
              class="block text-sm font-medium leading-6 text-primary"
            >
              Tipo de input <span class="text-red-500">*</span>
            </label>
            <select
              v-model="variable.field_type"
              id="field_type"
              class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm"
            >
              <option value="input">Texto simple</option>
              <option value="text_area">Texto largo</option>
              <option value="number">Número</option>
              <option value="date">Fecha</option>
              <option value="email">Correo electrónico</option>
              <option value="select">Selector</option>
            </select>
          </div>

          <!-- Summary field classification selector -->
          <div class="col-span-4">
            <label
              :for="'summary_field_' + index"
              class="block text-sm font-medium leading-6 text-primary"
            >
              Clasificar
            </label>
            <select
              v-model="variable.summary_field"
              :id="'summary_field_' + index"
              class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300"
              @change="() => handleSummaryFieldChange(variable)"
            >
              <option value="none">Sin clasificar</option>
              <option value="counterparty">Usuario / Contraparte</option>
              <option value="object">Objeto</option>
              <option value="value">Valor</option>
              <option value="term">Plazo</option>
              <option value="subscription_date">Fecha suscripción</option>
              <option value="start_date">Fecha inicio</option>
              <option value="end_date">Fecha fin</option>
            </select>
          </div>

          <!-- Currency selector (only for Valor classification) -->
          <div v-if="variable.summary_field === 'value'" class="col-span-4">
            <label
              :for="'currency_' + index"
              class="block text-sm font-medium leading-6 text-primary"
            >
              Moneda
            </label>
            <select
              v-model="variable.currency"
              :id="'currency_' + index"
              class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300"
            >
              <option value="">Sin moneda</option>
              <option value="COP">COP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          <!-- Select options configuration -->
          <div v-if="variable.field_type === 'select'" class="col-span-12 mt-2">
            <label class="block text-sm font-medium leading-6 text-primary">
              Opciones del selector (separadas por coma) <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              v-model="variable.select_options_text"
              @input="handleSelectOptionsInput($event, variable)"
              class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300"
              placeholder="Opción 1, Opción 2, Opción 3"
            />
          </div>
        </div>
      </div>

      <!-- Tag Management Section -->
      <DocumentTagsManager 
        ref="tagsManagerRef"
        :document="store.selectedDocument"
      />

      <!-- Permissions Management Section -->
      <DocumentPermissionsManager 
        ref="permissionsManagerRef"
        :document="store.selectedDocument"
      />

      <!-- Action Buttons -->
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 pt-6 border-t border-gray-200">
        <!-- Save as Draft button -->
        <button
          @click="validateAndSave('Draft')"
          type="button"
          class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span>Guardar como borrador</span>
        </button>
        
        <!-- Publish button -->
        <button
          @click="validateAndSave('Published')"
          type="button"
          class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-lg shadow-sm bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Publicar</span>
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
    </div>
  </div>


</template>

<script setup>
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import { showNotification } from "@/shared/notification_message";
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import Swal from "sweetalert2";
import DocumentPermissionsManager from "@/components/dynamic_document/lawyer/document-config/DocumentPermissionsManager.vue";
import DocumentTagsManager from "@/components/dynamic_document/lawyer/document-config/DocumentTagsManager.vue";

// Access route parameters and document store
const router = useRouter();
const store = useDynamicDocumentStore();
const userStore = useUserStore();
const validationErrors = ref([]);

// References to component managers
const permissionsManagerRef = ref(null);
const tagsManagerRef = ref(null);

// Check if current user is a lawyer
const isLawyer = computed(() => {
  return userStore.getCurrentUser?.role === 'lawyer';
});





// Initialize form data on mount
onMounted(async () => {
  if (!store.selectedDocument) {
    console.error("No selected document found");
    return;
  }

  // Fetch the complete document data with tags and permissions if we only have basic info
  if (store.selectedDocument.id && (!store.selectedDocument.tags || store.selectedDocument.tags.length === 0)) {
    try {
      const fullDocument = await store.fetchDocumentById(store.selectedDocument.id, true);
      store.selectedDocument = fullDocument;
    } catch (error) {
      console.error('Error fetching full document:', error);
    }
  }



  // Initialize select_options for select type fields
  if (store.selectedDocument?.variables) {
    store.selectedDocument.variables.forEach(variable => {
      if (variable.field_type === 'select') {
        if (!variable.select_options) {
          variable.select_options = [];
        }
        // Initialize the text representation
        variable.select_options_text = variable.select_options.join(', ');
      }

      // Ensure summary_field and currency have sensible defaults
      if (!variable.summary_field) {
        variable.summary_field = 'none';
      }
      if (variable.summary_field !== 'value') {
        // Currency only makes sense when variable is classified as Valor
        variable.currency = variable.currency || null;
      }
    });
  }
});





// Validation rules for different field types
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
  }
};

/**
 * Get the text representation of select options
 */
const getSelectOptionsText = (variable) => {
  if (!variable.select_options) {
    return '';
  }
  return Array.isArray(variable.select_options) ? variable.select_options.join(', ') : '';
};

/**
 * Handles the input of select options, converting comma-separated string to array
 */
const handleSelectOptionsInput = (event, variable) => {
  const value = event.target.value;
  // Update the text representation
  variable.select_options_text = value;
  // Convert text to array for select_options
  variable.select_options = value ? value.split(',').map(option => option.trim()).filter(option => option !== '') : [];
};

/**
 * Handle summary field classification changes for a variable.
 * Ensures only one variable per classification and adjusts field type when needed.
 */
const handleSummaryFieldChange = (changedVariable) => {
  if (!store.selectedDocument?.variables) return;

  const newValue = changedVariable.summary_field || 'none';

  // Ensure uniqueness: only one variable per summary_field (except 'none')
  if (newValue && newValue !== 'none') {
    store.selectedDocument.variables.forEach(variable => {
      if (variable !== changedVariable && variable.summary_field === newValue) {
        variable.summary_field = 'none';
      }
    });
  }

  // Auto-adjust field type for specific classifications
  if (newValue === 'value' && changedVariable.field_type !== 'number') {
    changedVariable.field_type = 'number';
  }

  if ((newValue === 'subscription_date' || newValue === 'start_date' || newValue === 'end_date') && changedVariable.field_type !== 'date') {
    changedVariable.field_type = 'date';
  }

  // Reset currency when classification is not value
  if (newValue !== 'value') {
    changedVariable.currency = null;
  }
};

/**
 * Validate form fields before saving.
 * @returns {boolean} - Returns true if all validations pass, false otherwise.
 */
const validateForm = () => {
  validationErrors.value = [];

  let isValid = true;
  store.selectedDocument?.variables.forEach((variable, index) => {
    const errors = [];
    
    // Validate name_es is required
    if (!variable.name_es || variable.name_es.trim() === '') {
      errors.push("El nombre en pantalla es obligatorio.");
    }
    
    // Validate field type specific rules
    if (variable.value && variable.value.trim() !== "") {
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
            errors.push("El valor no es válido para este tipo de campo.");
        }
      }
    }

    // Validate select options if field type is select
    if (variable.field_type === 'select' && (!variable.select_options || variable.select_options.length === 0)) {
      errors.push("Debe ingresar al menos una opción para el selector.");
    }

    if (errors.length > 0) {
      validationErrors.value[index] = errors.join(" ");
      isValid = false;
    }
  });

  if (!isValid) {
    Swal.fire({
      title: "Campos incompletos",
      text: "Por favor, verifica los campos obligatorios y sus formatos.",
      icon: "warning",
    });
  }

  return isValid;
};

/**
 * Validate and save the document.
 * @param {string} state - The state of the document ('Draft' or 'Published').
 */
const validateAndSave = (state) => {
  // Para borradores, permitir guardar sin validar todos los campos de variables
  if (state === 'Draft') {
    saveDocument(state);
    return;
  }

  // Para publicación, requerir formulario completo y válido
  if (validateForm()) {
    saveDocument(state);
  }
};

/**
 * Save or publish the document.
 * @param {string} state - The state of the document ('Draft' or 'Published').
 */
const saveDocument = async (state) => {
  try {
    // Get permissions data from the permissions manager component
    // Try getPermissionsDataExpanded first, fallback to getPermissionsData
    let permissionsData;
    if (permissionsManagerRef.value?.getPermissionsDataExpanded) {
      permissionsData = permissionsManagerRef.value.getPermissionsDataExpanded();
    } else if (permissionsManagerRef.value?.getPermissionsData) {
      const rawPermissions = permissionsManagerRef.value.getPermissionsData();
      
      // Manually expand roles to user_ids
      const expandRoles = (roles, clients) => {
        if (!roles || roles.length === 0) return [];
        const userIds = new Set();
        roles.forEach(roleCode => {
          clients.filter(c => c.role === roleCode).forEach(c => {
            const userId = c.user_id || c.id;
            if (userId) userIds.add(userId);
          });
        });
        return Array.from(userIds);
      };
      
      let clients = permissionsManagerRef.value?.availableClients?.value || permissionsManagerRef.value?.availableClients || [];
      
      // If no clients loaded, try to get from userStore
      if (clients.length === 0) {
        const userStore = useUserStore();
        if (userStore && userStore.users) {
          clients = userStore.users.filter(u => u.role !== 'lawyer') || [];
        }
      }
      const visibilityUserIds = rawPermissions.visibility?.user_ids || [];
      const usabilityUserIds = rawPermissions.usability?.user_ids || [];
      const visibilityRoleUserIds = expandRoles(rawPermissions.visibility?.roles || [], clients);
      const usabilityRoleUserIds = expandRoles(rawPermissions.usability?.roles || [], clients);
      
      permissionsData = {
        is_public: rawPermissions.is_public || false,
        visibility_user_ids: [...new Set([...visibilityUserIds, ...visibilityRoleUserIds])],
        usability_user_ids: [...new Set([...usabilityUserIds, ...usabilityRoleUserIds])]
      };
    } else {
      permissionsData = {};
    }
    
    
    // Get tag IDs from the tags manager component
    const tagIds = tagsManagerRef.value?.getTagIds() || [];
    
    const documentData = {
      title: store.selectedDocument.title,
      content: store.selectedDocument.content,
      state: state,
      variables: store.selectedDocument.variables.map((variable) => ({
        name_en: variable.name_en,
        name_es: variable.name_es,
        tooltip: variable.tooltip || "",
        field_type: variable.field_type,
        value: variable.value,
        select_options: variable.field_type === 'select' ? variable.select_options : null,
        summary_field: variable.summary_field || 'none',
        currency: variable.summary_field === 'value' ? (variable.currency || null) : null,
      })),
      // Add selected tags to the document data using tag_ids as expected by backend
      tag_ids: tagIds,
      // Add permissions data from the permissions manager component
      ...permissionsData
    };

    // Save current document data for reference
    const originalTitle = store.selectedDocument.title;
    const originalContent = store.selectedDocument.content;
    
    let documentId;
    let response;
    
    if (store.selectedDocument.id) {
      documentId = store.selectedDocument.id;
      response = await store.updateDocument(documentId, documentData);
    } else {
      response = await store.createDocument(documentData);
      if (response && response.id) {
        documentId = response.id;
      }
    }
    
    // Refresh documents to get the updated list
    store.selectedDocument = null;
    await store.init();
    
    // If we couldn't get an ID from the response, try to find the document by attributes
    if (!documentId) {
      const foundDoc = store.documents.find(doc => 
        doc.title === originalTitle &&
        doc.content === originalContent &&
        doc.state === state
      );
      
      if (foundDoc) {
        documentId = foundDoc.id;
      }
    }
    
    // Set lastUpdatedDocumentId explicitly to ensure the highlight effect works
    if (documentId) {
      // Set the ID in localStorage for persistence across redirects
      window.localStorage.setItem('lastUpdatedDocumentId', documentId.toString());
      store.lastUpdatedDocumentId = documentId;
    }
    
    await showNotification(
      state === "Draft"
        ? "Documento guardado como borrador"
        : "Documento publicado exitosamente",
      "success"
    );
    
    // Use a longer delay before redirect to ensure store state is properly saved
    setTimeout(() => {
      router.push("/dynamic_document_dashboard");
    }, 300);
  } catch (error) {
    console.error("Error saving document:", error);
  }
};

/**
 * Navigate back to the document dashboard
 */
const handleBack = () => {
  router.push("/dynamic_document_dashboard");
};
</script>
