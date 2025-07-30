import { ref, computed } from 'vue';
import { useDynamicDocumentStore } from '@/stores/dynamic_document';
import { useUserStore } from '@/stores/user';
import { showNotification } from '@/shared/notification_message';
import { getAllColors, getColorById } from '@/shared/color_palette';
import Swal from 'sweetalert2';

export function useDocumentTags() {
  // Stores
  const store = useDynamicDocumentStore();
  const userStore = useUserStore();
  
  // Reactive state
  const selectedTags = ref([]);
  const showTagModal = ref(false);
  const isEditingTag = ref(false);
  const currentTag = ref({
    name: '',
    color_id: 1
  });

  // Check if current user is a lawyer
  const isLawyer = computed(() => {
    return userStore.getCurrentUser?.role === 'lawyer';
  });

  // Get available colors for tag creation
  const availableColors = computed(() => getAllColors());

  /**
   * Initialize tags for a document
   */
  const initializeTags = async (document) => {
    if (!isLawyer.value) return;
    
    // Initialize tags store if needed
    await store.initTags();
    
    // Load existing tags if document has them
    if (document?.tags && document.tags.length > 0) {
      selectedTags.value = [...document.tags];
    } else {
      selectedTags.value = [];
    }
  };

  /**
   * Open tag creation modal
   */
  const openCreateTagModal = () => {
    currentTag.value = {
      name: '',
      color_id: 1
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
      name: '',
      color_id: 1
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

  /**
   * Get tag IDs for saving
   */
  const getTagIds = () => {
    return selectedTags.value.map(tag => tag.id);
  };

  return {
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
  };
} 