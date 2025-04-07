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
            'col-span-1': variable.field_type === 'input',
          }"
        >
          <div class="flex items-center gap-2">
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

          <input
            v-if="variable.field_type === 'input'"
            type="text"
            v-model="variable.value"
            :id="'field-' + index"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300"
          />

          <textarea
            v-if="variable.field_type === 'text_area'"
            v-model="variable.value"
            :id="'field-' + index"
            class="block w-full rounded-md border-0 py-1.5 text-primary shadow-sm ring-1 ring-inset ring-gray-300"
          ></textarea>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="mt-6 flex space-x-4">
        <button
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
            !allFieldsComplete
              ? 'bg-gray-200 text-secondary border-2 border-dashed border-secondary cursor-not-allowed bg-opacity-50'
              : 'bg-secondary text-white'
          "
          :disabled="!allFieldsComplete"
          @click="saveDocument('Completed')"
        >
          {{ isEditMode ? "Completar y Generar" : "Generar" }}
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
  <div v-else class="text-center text-gray-500">
    <p>Cargando documento...</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { InformationCircleIcon } from "@heroicons/vue/24/outline";
import { showNotification } from "@/shared/notification_message";

const route = useRoute();
const router = useRouter();
const store = useDynamicDocumentStore();

const documentBase = ref(null);
const document = ref(null);

// Detect edit mode based on the presence of a document ID
const isEditMode = ref(false);

/**
 * Fetches document data based on the route parameters when the component is mounted.
 */
onMounted(async () => {
  const documentId = route.params.id;
  isEditMode.value = route.params.mode == "editor" ? true : false;
  documentBase.value = await store.documentById(documentId);

  if (route.params.mode == "creator") {
    document.value = {
      title: route.params.title,
      variables: documentBase.value.variables,
      content: documentBase.value.content,
      created_by: documentBase.value.created_by,
      assigned_to: store.currentUser?.id || null,
    };
  }

  if (route.params.mode == "editor") {
    document.value = documentBase.value;
    document.value.title = route.params.title;
  }
});

/**
 * Computes whether all required fields in the document are complete.
 *
 * @returns {Boolean} True if all variables have values, false otherwise.
 */
const allFieldsComplete = computed(() => {
  return document.value?.variables.every(
    (variable) => variable.value && variable.value.trim().length > 0
  );
});

/**
 * Saves the document based on its mode (edit or create).
 *
 * @param {String} state - The state of the document (e.g., "Completed", "Draft").
 */
const saveDocument = async (state = 'Draft') => {
  try {
    document.value.state = state;
    
    let documentId = null;
    
    // Update existing document
    if (isEditMode.value && document.value.id) {
      await store.updateDocument(document.value.id, document.value);
      documentId = document.value.id;
    } 
    // Create new document
    else {
      // Before creating, ensure client is set
      if (store.currentUser?.id && !document.value.client_id) {
        document.value.created_by = store.currentUser.id;
      }
      
      if (document.value.variables) {
        document.value.variables = document.value.variables.map(variable => ({
          name_en: variable.name_en,
          name_es: variable.name_es,
          field_type: variable.field_type,
          value: variable.value,
          tooltip: variable.tooltip
        }));
      }
      
      // Get current document count for comparison later
      const currentDocCount = store.documents.length;
      
      // Create document and get result
      const createdDoc = await store.createDocument(document.value);
      
      // If we got an ID directly from the response
      if (createdDoc && createdDoc.id) {
        documentId = createdDoc.id;
      } 
      // Need to find the document ID
      else {
        // Refresh the documents list to get the new one
        await store.init();
        
        // Find most likely match by filtering criteria
        const newDocs = store.documents.filter(doc => 
          doc.title === document.value.title &&
          doc.content === document.value.content
        );

        if (newDocs.length > 0) {
          // Use the newest document with matching criteria
          documentId = newDocs[newDocs.length - 1].id;
        } else {
          // Fallback to the newest document
          documentId = store.documents[store.documents.length - 1]?.id;
          
          if (!documentId) {
            // Last resort
            documentId = store.lastUpdatedDocumentId;
          }
        }
      }
    }
    
    // Set lastUpdatedDocumentId to highlight the document in the list
    if (documentId) {
      localStorage.setItem('lastUpdatedDocumentId', documentId.toString());
      store.lastUpdatedDocumentId = documentId;
    }
    
    await showNotification('Documento guardado exitosamente', 'success');
    
    // Redirect to dashboard after a short delay
    setTimeout(() => {
      router.push('/dynamic_document_dashboard');
    }, 500);
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
