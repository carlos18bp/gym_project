<template>
  <div class="tag-filter-container">
    <!-- Filter Button -->
    <div class="relative">
      <button
        @click="toggleDropdown"
        class="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
        :class="{ 'ring-2 ring-primary': isOpen }"
      >
        <TagIcon class="h-4 w-4 mr-2" />
        <span>Filtrar por etiquetas</span>
        <span v-if="selectedTags.length > 0" class="ml-2 bg-primary text-white text-xs rounded-full px-2 py-0.5">
          {{ selectedTags.length }}
        </span>
        <ChevronDownIcon 
          class="ml-2 h-4 w-4 transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
        />
      </button>

      <!-- Dropdown Menu -->
      <div
        v-if="isOpen"
        class="absolute left-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
      >
        <!-- Search Bar -->
        <div class="p-3 border-b border-gray-200">
          <div class="relative">
            <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar etiquetas..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <!-- Clear All Option -->
        <div v-if="selectedTags.length > 0" class="px-4 py-2 border-b border-gray-200">
          <button
            @click="clearAllTags"
            class="text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
          >
            Limpiar filtros
          </button>
        </div>

        <!-- Tags Container with Scroll -->
        <div class="max-h-48 overflow-y-auto">
          <!-- No Tags Message -->
          <div v-if="!isLoadingTags && filteredTags.length === 0 && searchQuery.trim() === ''" class="px-4 py-6 text-center">
            <p class="text-gray-500 text-sm">No hay etiquetas disponibles</p>
          </div>

          <!-- No Search Results -->
          <div v-if="!isLoadingTags && filteredTags.length === 0 && searchQuery.trim() !== ''" class="px-4 py-6 text-center">
            <p class="text-gray-500 text-sm">No se encontraron etiquetas que coincidan con "{{ searchQuery }}"</p>
          </div>

          <!-- Loading State -->
          <div v-if="isLoadingTags" class="px-4 py-6 text-center">
            <div class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span class="ml-2 text-sm text-gray-500">Cargando etiquetas...</span>
            </div>
          </div>

          <!-- Tags List -->
          <div v-if="!isLoadingTags && filteredTags.length > 0" class="py-1">
            <div
              v-for="tag in filteredTags"
              :key="tag.id"
              class="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
              @click="toggleTag(tag)"
            >
              <!-- Checkbox -->
              <div class="flex items-center h-5">
                <input
                  :id="`tag-${tag.id}`"
                  type="checkbox"
                  :checked="isTagSelected(tag)"
                  @change="toggleTag(tag)"
                  class="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
              </div>
              
              <!-- Tag Display -->
              <div class="ml-3 flex items-center">
                <div
                  class="w-4 h-4 rounded-full mr-2 border border-gray-300"
                  :style="{ backgroundColor: getTagColor(tag).hex }"
                ></div>
                <span class="text-sm font-medium text-gray-900">{{ tag.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected Tags Display -->
    <div v-if="selectedTags.length > 0" class="mt-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs font-medium text-gray-500">Filtrando por:</span>
        <div
          v-for="tag in selectedTags"
          :key="tag.id"
          class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all duration-200 hover:shadow-sm"
          :style="{ 
            backgroundColor: getTagColor(tag).hex,
            color: getTagColor(tag).dark,
            borderColor: getTagColor(tag).dark
          }"
          @click="toggleTag(tag)"
        >
          <span class="mr-1">{{ tag.name }}</span>
          <XMarkIcon class="h-3 w-3" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useDynamicDocumentStore } from '@/stores/dynamicDocument';
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