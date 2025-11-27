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

          <!-- Number input -->
          <input
            v-if="variable.field_type === 'number'"
            type="number"
            v-model="variable.value"
            :id="'field-' + index"
            step="any"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-secondary"
            :class="{ 'ring-red-300': validationErrors[index] }"
            @input="validateField(variable, index)"
          />

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
      <div class="mt-6 flex space-x-4">
        <button
          v-if="route.params.mode !== 'formalize'"
          type="button"
          class="p-2.5 text-sm font-medium rounded-md flex gap-2 bg-secondary text-white"
          @click="saveDocument('Progress')"
        >
          {{ isEditMode ? "Guardar cambios como Borrador" : "Guardar progreso" }}
        </button>
        <button
          type="button"
          class="p-2.5 text-sm font-medium rounded-md flex gap-2"
          :class="
            !allFieldsComplete || (route.params.mode === 'formalize' && selectedSigners.length === 0)
              ? 'bg-gray-200 text-secondary border-2 border-dashed border-secondary cursor-not-allowed bg-opacity-50'
              : 'bg-secondary text-white'
          "
          :disabled="!allFieldsComplete || (route.params.mode === 'formalize' && selectedSigners.length === 0)"
          @click="saveDocument(route.params.mode === 'formalize' ? 'Published' : 'Completed')"
        >
          {{ route.params.mode === 'formalize' ? 'Formalizar y Agregar Firmas' : (isEditMode ? "Completar y Generar" : "Generar") }}
        </button>
        <button
          @click="handleBack()"
          type="button"
          class="p-2.5 text-sm font-medium rounded-md flex gap-2 bg-red-600/80 text-white cursor-pointer"
        >
          Cancelar
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
      </div>
    </div>
  </div>
  <div v-else class="text-center text-gray-500">
    <p>Cargando documento...</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamic_document";
import { useUserStore } from "@/stores/auth/user";
import { InformationCircleIcon } from "@heroicons/vue/24/outline";
import { showNotification } from "@/shared/notification_message";
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
const validationErrors = ref([]);

// Detect edit mode based on the presence of a document ID
const isEditMode = ref(false);

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
  isEditMode.value = route.params.mode === "editor" || route.params.mode === "formalize";
  documentBase.value = await store.documentById(documentId);

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

  if (route.params.mode === "editor" || route.params.mode === "formalize") {
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
    const finalState = isClientCreatingFromTemplate ? 'Progress' : 
                      (route.params.mode === 'formalize' ? 'PendingSignatures' : state);
    
    const documentData = {
      title: document.value.title,
      content: document.value.content,
      state: finalState,
      // Assign to current user if creating from template or if document doesn't have assigned_to
      assigned_to: (isClientCreatingFromTemplate || !document.value.assigned_to) && userId ? userId : document.value.assigned_to,
      variables: document.value.variables.map((variable) => ({
        name_en: variable.name_en,
        name_es: variable.name_es,
        tooltip: variable.tooltip || "",
        field_type: variable.field_type,
        value: variable.value,
        select_options: variable.field_type === 'select' ? variable.select_options : null
      })),
      // Add signature data if in formalize mode
      requires_signature: route.params.mode === 'formalize',
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
      }
    }
    // For other modes, update or create as needed
    else if (isEditMode.value && document.value.id) {
      await store.updateDocument(document.value.id, documentData);
      documentId = document.value.id;
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
        : state === "Draft"
          ? "Documento guardado como borrador"
          : "Documento publicado exitosamente",
      "success"
    );
    
    // Redirect to dashboard after a short delay
    setTimeout(() => {
      // If in formalize mode, redirect to pending signatures tab
      if (route.params.mode === 'formalize') {
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
</script>
