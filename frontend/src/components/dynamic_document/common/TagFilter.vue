<template>
  <div class="tag-filter-container">
    <!-- Filter Button - Redesigned -->
    <div class="relative">
      <button
        @click="toggleDropdown"
        class="group inline-flex items-center justify-between w-full sm:w-auto sm:min-w-[200px] px-4 py-3 border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary transition-all duration-200"
        :class="{ 
          'ring-2 ring-primary border-primary bg-blue-50': isOpen,
          'border-primary bg-primary/5': selectedTags.length > 0 && !isOpen
        }"
      >
        <div class="flex items-center">
          <TagIcon class="h-5 w-5 mr-2.5 text-gray-500 group-hover:text-gray-600" 
                   :class="{ 'text-primary': selectedTags.length > 0 || isOpen }" />
          <span class="text-gray-700" 
                :class="{ 'text-primary font-semibold': selectedTags.length > 0 || isOpen }">
            Filtrar por etiquetas
          </span>
          <span v-if="selectedTags.length > 0" 
                class="ml-2 inline-flex items-center justify-center h-5 w-5 bg-primary text-white text-xs rounded-full font-medium">
            {{ selectedTags.length }}
          </span>
        </div>
        <ChevronDownIcon 
          class="ml-3 h-4 w-4 text-gray-400 transition-all duration-200 group-hover:text-gray-600"
          :class="{ 
            'rotate-180 text-primary': isOpen,
            'text-primary': selectedTags.length > 0 && !isOpen
          }"
        />
      </button>

      <!-- Dropdown Menu - Enhanced -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="isOpen"
          class="absolute left-0 mt-2 w-full sm:w-80 bg-white rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 border border-gray-100 z-50 overflow-hidden"
        >
          <!-- Header with Search -->
          <div class="bg-gray-50 p-4 border-b border-gray-200">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-gray-900">Filtrar por etiquetas</h3>
              <span v-if="availableTags.length > 0" class="text-xs text-gray-500">
                {{ availableTags.length }} disponibles
              </span>
            </div>
            <div class="relative">
              <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Buscar etiquetas..."
                class="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          <!-- Actions Bar -->
          <div v-if="selectedTags.length > 0" class="px-4 py-2 bg-blue-50 border-b border-blue-100">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-blue-700">
                {{ selectedTags.length }} etiqueta{{ selectedTags.length !== 1 ? 's' : '' }} seleccionada{{ selectedTags.length !== 1 ? 's' : '' }}
              </span>
              <button
                @click="clearAllTags"
                class="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded-md hover:bg-red-50 transition-all duration-200"
              >
                Limpiar todo
              </button>
            </div>
          </div>

          <!-- Tags Container with Scroll -->
          <div class="max-h-52 overflow-y-auto">
            <!-- No Tags Message -->
            <div v-if="!isLoadingTags && filteredTags.length === 0 && searchQuery.trim() === ''" class="px-4 py-8 text-center">
              <TagIcon class="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p class="text-gray-500 text-sm">No hay etiquetas disponibles</p>
            </div>

            <!-- No Search Results -->
            <div v-if="!isLoadingTags && filteredTags.length === 0 && searchQuery.trim() !== ''" class="px-4 py-8 text-center">
              <MagnifyingGlassIcon class="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p class="text-gray-500 text-sm">Sin resultados para "{{ searchQuery }}"</p>
              <button 
                @click="searchQuery = ''"
                class="text-xs text-primary hover:text-primary-dark mt-2 font-medium"
              >
                Ver todas las etiquetas
              </button>
            </div>

            <!-- Loading State -->
            <div v-if="isLoadingTags" class="px-4 py-8 text-center">
              <div class="flex items-center justify-center">
                <div class="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
                <span class="ml-3 text-sm text-gray-600">Cargando etiquetas...</span>
              </div>
            </div>

            <!-- Tags List -->
            <div v-if="!isLoadingTags && filteredTags.length > 0" class="py-2">
              <div
                v-for="tag in filteredTags"
                :key="tag.id"
                class="group flex items-center px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                @click="toggleTag(tag)"
              >
                <!-- Custom Checkbox -->
                <div class="flex items-center h-5">
                  <div class="relative">
                    <input
                      :id="`tag-${tag.id}`"
                      type="checkbox"
                      :checked="isTagSelected(tag)"
                      @change="toggleTag(tag)"
                      class="sr-only"
                    />
                    <div 
                      class="w-4 h-4 border-2 rounded transition-all duration-200 flex items-center justify-center"
                      :class="isTagSelected(tag) 
                        ? 'bg-primary border-primary' 
                        : 'border-gray-300 group-hover:border-gray-400'"
                    >
                      <svg v-if="isTagSelected(tag)" class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <!-- Tag Display -->
                <div class="ml-3 flex items-center flex-1 min-w-0">
                  <div
                    class="w-3 h-3 rounded-full mr-2.5 border flex-shrink-0 shadow-sm"
                    :style="{ backgroundColor: getTagColor(tag).hex }"
                  ></div>
                  <span class="text-sm font-medium text-gray-900 truncate">{{ tag.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Selected Tags Display - Enhanced -->
    <div v-if="selectedTags.length > 0" class="mt-4">
      <div class="flex items-start gap-2">
        <span class="text-xs font-medium text-gray-500 mt-1.5 flex-shrink-0">Activos:</span>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="tag in selectedTags"
            :key="tag.id"
            class="group inline-flex items-center pl-2.5 pr-1.5 py-1.5 rounded-lg text-xs font-medium border shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md"
            :style="{ 
              backgroundColor: getTagColor(tag).hex + '20',
              borderColor: getTagColor(tag).hex + '40',
              color: getTagColor(tag).dark
            }"
            @click="toggleTag(tag)"
          >
            <div
              class="w-2 h-2 rounded-full mr-2 flex-shrink-0"
              :style="{ backgroundColor: getTagColor(tag).hex }"
            ></div>
            <span class="mr-1">{{ tag.name }}</span>
            <div class="ml-1 p-0.5 rounded-full hover:bg-white/50 transition-colors duration-150">
              <XMarkIcon class="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useDynamicDocumentStore } from '@/stores/dynamic_document';
import { getColorById } from '@/shared/color_palette';
import { TagIcon, ChevronDownIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';

// Props definition
const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
});

// Emits definition
const emit = defineEmits(['update:modelValue']);

// Store instance
const documentStore = useDynamicDocumentStore();

// Reactive state
const isOpen = ref(false);
const selectedTags = ref([]);
const isLoadingTags = ref(false);
const searchQuery = ref('');

// Computed properties

/**
 * Gets available tags from the document store
 */
const availableTags = computed(() => documentStore.sortedTags);

/**
 * Filters tags based on search query
 */
const filteredTags = computed(() => {
  if (!searchQuery.value.trim()) {
    return availableTags.value;
  }
  
  const query = searchQuery.value.toLowerCase().trim();
  return availableTags.value.filter(tag => 
    tag.name.toLowerCase().includes(query)
  );
});

/**
 * Gets safe color properties for a tag
 */
const getTagColor = (tag) => {
  const colorData = getColorById(tag.color_id);
  return {
    hex: colorData && colorData.hex ? colorData.hex : '#9CA3AF',
    dark: colorData && colorData.dark ? colorData.dark : '#374151'
  };
};

// Methods

/**
 * Toggles the dropdown visibility
 */
const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
  // Clear search when opening dropdown
  if (isOpen.value) {
    searchQuery.value = '';
  }
};

/**
 * Checks if a tag is currently selected
 */
const isTagSelected = (tag) => {
  return selectedTags.value.some(selectedTag => selectedTag.id === tag.id);
};

/**
 * Toggles a tag selection state
 */
const toggleTag = (tag) => {
  const index = selectedTags.value.findIndex(selectedTag => selectedTag.id === tag.id);
  
  if (index >= 0) {
    // Remove tag from selection
    selectedTags.value.splice(index, 1);
  } else {
    // Add tag to selection
    selectedTags.value.push(tag);
  }
  
  // Emit the updated selection to parent component
  emit('update:modelValue', selectedTags.value);
};

/**
 * Clears all selected tags
 */
const clearAllTags = () => {
  selectedTags.value = [];
  emit('update:modelValue', []);
};

/**
 * Handles clicks outside the component to close dropdown
 */
const handleClickOutside = (event) => {
  if (!event.target.closest('.tag-filter-container')) {
    isOpen.value = false;
    searchQuery.value = '';
  }
};

// Lifecycle hooks

/**
 * Initialize tags when component mounts
 */
onMounted(async () => {
  try {
    isLoadingTags.value = true;
    await documentStore.initTags();
  } catch (error) {
    console.error('Error loading tags:', error);
  } finally {
    isLoadingTags.value = false;
  }
  
  // Add event listener for clicks outside
  document.addEventListener('click', handleClickOutside);
});

// Watchers

/**
 * Watch for prop changes to sync with parent component
 */
watch(() => props.modelValue, (newValue) => {
  selectedTags.value = newValue || [];
}, { immediate: true });

// Cleanup

/**
 * Remove event listener when component is unmounted
 */
import { onUnmounted } from 'vue';
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.tag-filter-container {
  position: relative;
}

/* Ensure dropdown appears above other content */
.tag-filter-container .absolute {
  z-index: 50;
}

/* Smooth transitions for dropdown */
.tag-filter-container .transition-transform {
  transition: transform 0.2s ease-in-out;
}

/* Custom scrollbar for dropdown */
.max-h-48::-webkit-scrollbar {
  width: 6px;
}

.max-h-48::-webkit-scrollbar-track {
  background: #f8f9fa;
  border-radius: 3px;
}

.max-h-48::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.max-h-48::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Search input focus styles */
.tag-filter-container input:focus {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}
</style> 