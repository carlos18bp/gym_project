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
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { showNotification } from "@/shared/notification_message";
import Swal from "sweetalert2";

// Access route parameters and document store
const router = useRouter();
const store = useDynamicDocumentStore();
const validationErrors = ref([]);

// Initialize form data on mount
onMounted(() => {
  if (!store.selectedDocument) {
    console.error("No selected document found");
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
      }))
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
