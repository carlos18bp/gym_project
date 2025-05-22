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
            </select>
          </div>
        </div>
      </div>

      <!-- Signature Configuration Section -->
      <div class="mt-8 pt-6 border-t border-gray-200">
        <h2 class="text-primary text-lg font-semibold">Configuración de firmas</h2>
        
        <div class="mt-4">
          <div class="flex items-center">
            <input 
              type="checkbox" 
              id="requires_signature" 
              v-model="requiresSignature"
              class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              @change="handleSignatureRequirementChange" 
            />
            <label for="requires_signature" class="ml-2 block text-sm text-primary">
              Este documento requiere firmas
            </label>
          </div>
        </div>

        <!-- User Selection for Signatures (visible only when requires_signature is true) -->
        <div v-if="requiresSignature" class="mt-4">
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

      <!-- Action Buttons -->
      <div class="mt-6 flex space-x-4">
        <button
          @click="validateAndSave('Draft')"
          class="p-2.5 text-sm font-medium rounded-md bg-secondary text-white"
        >
          Guardar como borrador
        </button>
        <button
          @click="validateAndSave('Published')"
          class="p-2.5 text-sm font-medium rounded-md bg-gray-200 text-secondary border-2"
        >
          Publicar
        </button>
        <button
          @click="handleBack()"
          type="button"
          class="p-2.5 text-sm font-medium rounded-md flex gap-2 bg-red-600/80 text-white cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user"; // Add user store import
import { showNotification } from "@/shared/notification_message";
import Swal from "sweetalert2";

// Access route parameters and document store
const router = useRouter();
const store = useDynamicDocumentStore();
const userStore = useUserStore(); // Initialize user store
const validationErrors = ref([]);

// Signature management variables
const requiresSignature = ref(false);
const selectedSigners = ref([]);
const userSearchQuery = ref('');
const filteredUsers = ref([]);
const showUserResults = ref(false);

// Initialize form data on mount
onMounted(async () => {
  if (!store.selectedDocument) {
    console.error("No selected document found");
  } else {
    // Initialize signature state if document already exists
    requiresSignature.value = store.selectedDocument.requires_signature || false;
    
    // Initialize signers if document already had them
    if (requiresSignature.value && store.selectedDocument.signer_ids && store.selectedDocument.signer_ids.length > 0) {
      // Get full user data for signers using the signer_ids from the API
      const signerIds = store.selectedDocument.signer_ids;
      if (signerIds.length > 0) {
        // Get complete user information
        const users = await userStore.getUsersByIds(signerIds);
        selectedSigners.value = users;
      }
    }
  }
  
  // Ensure we have users loaded for search
  if (!userStore.users || userStore.users.length === 0) {
    await userStore.fetchUsers();
  }
});

/**
 * Handle change in signature requirement checkbox
 */
const handleSignatureRequirementChange = () => {
  if (!requiresSignature.value) {
    // Clear selected signers if checkbox is unchecked
    selectedSigners.value = [];
  }
};

/**
 * Search for users based on input query
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
 * Add a signer to the selected list
 * @param {Object} user - The user object to add as a signer
 */
const addSigner = (user) => {
  selectedSigners.value.push(user);
  userSearchQuery.value = '';
  filteredUsers.value = [];
  showUserResults.value = false;
};

/**
 * Remove a signer from the selected list
 * @param {Object} user - The user object to remove
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
 * Validate form fields before saving.
 * @returns {boolean} - Returns true if all validations pass, false otherwise.
 */
const validateForm = () => {
  validationErrors.value = [];

  let isValid = true;
  store.selectedDocument?.variables.forEach((variable, index) => {
    if (!variable.name_es || variable.name_es.trim() === "") {
      validationErrors.value[index] = "Este campo es obligatorio.";
      isValid = false;
    }
  });

  // Validate that at least one signer is selected if signatures are required
  if (requiresSignature.value && selectedSigners.value.length === 0) {
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
      text: "Por favor, completa todos los campos obligatorios.",
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
      })),
      // Add signature data
      requires_signature: requiresSignature.value,
      signers: requiresSignature.value ? selectedSigners.value.map(user => user.id) : []
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
