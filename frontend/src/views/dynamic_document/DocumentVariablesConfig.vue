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

      <!-- Tag Management Section (visible only to lawyers) -->
      <div v-if="isLawyer" class="mt-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-primary">Etiquetas del Documento</h3>
          <button
            @click="openCreateTagModal"
            type="button"
            class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-secondary hover:bg-secondary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary"
          >
            <PlusIcon class="h-4 w-4 mr-2" />
            Nueva Etiqueta
          </button>
        </div>

        <!-- Available Tags -->
        <div class="space-y-3">
          <div v-if="store.tags && store.tags.length > 0">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Etiquetas Disponibles:</h4>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="tag in store.sortedTags"
                :key="tag.id"
                class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border-2 cursor-pointer transition-all duration-200"
                :style="getTagColorStyles(tag.color_id)"
                :class="{
                  'ring-2 ring-secondary': isTagSelected(tag),
                  'hover:shadow-md': true
                }"
                @click="toggleTagSelection(tag)"
              >
                <span class="mr-2">{{ tag.name }}</span>
                <button
                  @click.stop="openEditTagModal(tag)"
                  class="ml-2 p-1 hover:bg-black hover:bg-opacity-10 rounded"
                  title="Editar etiqueta"
                >
                  <PencilIcon class="h-3 w-3" />
                </button>
                <button
                  @click.stop="deleteTag(tag)"
                  class="ml-1 p-1 hover:bg-red-500 hover:bg-opacity-20 rounded"
                  title="Eliminar etiqueta"
                >
                  <TrashIcon class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <!-- Selected Tags -->
          <div v-if="selectedTags.length > 0">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Etiquetas Seleccionadas:</h4>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="tag in selectedTags"
                :key="tag.id"
                class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border-2 ring-2 ring-secondary"
                :style="getTagColorStyles(tag.color_id)"
              >
                <span class="mr-2">{{ tag.name }}</span>
                <button
                  @click="toggleTagSelection(tag)"
                  class="ml-2 p-1 hover:bg-red-500 hover:bg-opacity-20 rounded"
                  title="Remover etiqueta"
                >
                  <XMarkIcon class="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          <!-- No tags message -->
          <div v-if="!store.tags || store.tags.length === 0" class="text-center py-6">
            <p class="text-gray-500">No hay etiquetas disponibles.</p>
            <p class="text-gray-400 text-sm mt-1">Crea la primera etiqueta para organizar tus documentos.</p>
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

  <!-- Tag Creation/Edit Modal -->
  <div
    v-if="showTagModal"
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
    @click="closeTagModal"
  >
    <div
      class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
      @click.stop
    >
      <div class="mt-3">
        <h3 class="text-lg font-medium text-gray-900 mb-4">
          {{ isEditingTag ? 'Editar Etiqueta' : 'Nueva Etiqueta' }}
        </h3>
        
        <!-- Tag Name Input -->
        <div class="mb-4">
          <label for="tag-name" class="block text-sm font-medium text-gray-700 mb-2">
            Nombre de la etiqueta
          </label>
          <input
            id="tag-name"
            v-model="currentTag.name"
            type="text"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-secondary focus:ring-secondary sm:text-sm"
            placeholder="Ingresa el nombre de la etiqueta"
            @keydown.enter="saveTag"
          />
        </div>

        <!-- Color Selection -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Color de la etiqueta
          </label>
          <div class="grid grid-cols-8 gap-2">
            <div
              v-for="color in availableColors"
              :key="color.id"
              class="w-8 h-8 rounded-full cursor-pointer border-2 transition-all duration-200"
              :style="{ backgroundColor: color.hex }"
              :class="{
                'ring-2 ring-secondary': currentTag.color_id === color.id,
                'border-gray-300': currentTag.color_id !== color.id,
                'border-secondary': currentTag.color_id === color.id
              }"
              @click="currentTag.color_id = color.id"
              :title="color.name"
            ></div>
          </div>
        </div>

        <!-- Modal Actions -->
        <div class="flex justify-end space-x-3">
          <button
            @click="closeTagModal"
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancelar
          </button>
          <button
            @click="saveTag"
            type="button"
            class="px-4 py-2 text-sm font-medium text-white bg-secondary rounded-md hover:bg-secondary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary"
          >
            {{ isEditingTag ? 'Actualizar' : 'Crear' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useDynamicDocumentStore } from "@/stores/dynamicDocument";
import { useUserStore } from "@/stores/user";
import { showNotification } from "@/shared/notification_message";
import { getAllColors, getColorById } from "@/shared/color_palette";
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import Swal from "sweetalert2";

// Access route parameters and document store
const router = useRouter();
const store = useDynamicDocumentStore();
const userStore = useUserStore();
const validationErrors = ref([]);

// Tag management state
const selectedTags = ref([]);
const showTagModal = ref(false);
const isEditingTag = ref(false);
const currentTag = ref({
  id: null,
  name: '',
  color_id: 0
});

// Check if current user is a lawyer
const isLawyer = computed(() => {
  return userStore.getCurrentUser?.role === 'lawyer';
});

// Get available colors for tag creation
const availableColors = computed(() => getAllColors());

// Initialize form data on mount
onMounted(async () => {
  if (!store.selectedDocument) {
    console.error("No selected document found");
    return;
  }

  // Fetch the complete document data with tags if we only have basic info
  if (store.selectedDocument.id && (!store.selectedDocument.tags || store.selectedDocument.tags.length === 0)) {
    try {
      const fullDocument = await store.fetchDocumentById(store.selectedDocument.id, true);
      store.selectedDocument = fullDocument;
    } catch (error) {
      console.error('Error fetching full document:', error);
    }
  }

  // Initialize tags if user is a lawyer
  if (isLawyer.value) {
    await store.initTags();
  }

  // Load existing tags if document has them
  if (store.selectedDocument?.tags && store.selectedDocument.tags.length > 0) {
    selectedTags.value = [...store.selectedDocument.tags];
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
    });
  }
});

// =============================================
// TAG MANAGEMENT METHODS
// =============================================

/**
 * Open tag creation modal
 */
const openCreateTagModal = () => {
  currentTag.value = {
    id: null,
    name: '',
    color_id: 0
  };
  isEditingTag.value = false;
  showTagModal.value = true;
};

/**
 * Open tag editing modal
 */
const openEditTagModal = (tag) => {
  currentTag.value = { ...tag };
  isEditingTag.value = true;
  showTagModal.value = true;
};

/**
 * Close tag modal
 */
const closeTagModal = () => {
  showTagModal.value = false;
  currentTag.value = {
    id: null,
    name: '',
    color_id: 0
  };
  isEditingTag.value = false;
};

/**
 * Save tag (create or update)
 */
const saveTag = async () => {
  if (!currentTag.value.name.trim()) {
    await showNotification('El nombre de la etiqueta es requerido', 'error');
    return;
  }

  try {
    if (isEditingTag.value) {
      // Update existing tag
      await store.updateTag(currentTag.value.id, {
        name: currentTag.value.name,
        color_id: currentTag.value.color_id
      });
      
      await showNotification('Etiqueta actualizada exitosamente', 'success');
    } else {
      // Create new tag
      await store.createTag({
        name: currentTag.value.name,
        color_id: currentTag.value.color_id
      });
      
      await showNotification('Etiqueta creada exitosamente', 'success');
    }
    
    closeTagModal();
  } catch (error) {
    console.error('Error saving tag:', error);
    await showNotification('Error al guardar la etiqueta', 'error');
  }
};

/**
 * Delete tag with confirmation
 */
const deleteTag = async (tag) => {
  const result = await Swal.fire({
    title: '¿Estás seguro?',
    text: `¿Deseas eliminar la etiqueta "${tag.name}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (result.isConfirmed) {
    try {
      const success = await store.deleteTag(tag.id);
      
      if (success) {
        // Remove from selected tags if it was selected
        selectedTags.value = selectedTags.value.filter(t => t.id !== tag.id);
        await showNotification('Etiqueta eliminada exitosamente', 'success');
      } else {
        await showNotification('Error al eliminar la etiqueta', 'error');
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      await showNotification('Error al eliminar la etiqueta', 'error');
    }
  }
};

/**
 * Toggle tag selection
 */
const toggleTagSelection = (tag) => {
  const index = selectedTags.value.findIndex(t => t.id === tag.id);
  
  if (index >= 0) {
    selectedTags.value.splice(index, 1);
  } else {
    selectedTags.value.push(tag);
  }
};

/**
 * Check if tag is selected
 */
const isTagSelected = (tag) => {
  return selectedTags.value.some(t => t.id === tag.id);
};

/**
 * Get tag color styles
 */
const getTagColorStyles = (colorId) => {
  const color = getColorById(colorId);
  return {
    backgroundColor: color.light,
    borderColor: color.dark,
    color: color.dark
  };
};

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
        select_options: variable.field_type === 'select' ? variable.select_options : null
      })),
      // Add selected tags to the document data using tag_ids as expected by backend
      tag_ids: selectedTags.value.map(tag => tag.id)
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
