<template>
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
import { onMounted } from 'vue';
import { useDynamicDocumentStore } from '@/stores/dynamic_document';
import { useDocumentTags } from '@/composables/document-variables/useDocumentTags';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline';

// Props
const props = defineProps({
  document: {
    type: Object,
    default: null
  }
});

// Store
const store = useDynamicDocumentStore();

// Use the tags composable
const {
  // State
  selectedTags,
  showTagModal,
  isEditingTag,
  currentTag,
  
  // Computed
  isLawyer,
  availableColors,
  
  // Methods
  initializeTags,
  openCreateTagModal,
  openEditTagModal,
  closeTagModal,
  saveTag,
  deleteTag,
  toggleTagSelection,
  isTagSelected,
  getTagColorStyles,
  getTagIds
} = useDocumentTags();

// Initialize tags on mount
onMounted(async () => {
  if (props.document) {
    await initializeTags(props.document);
  }
});

// Expose methods for parent component
defineExpose({
  getTagIds
});
</script> 