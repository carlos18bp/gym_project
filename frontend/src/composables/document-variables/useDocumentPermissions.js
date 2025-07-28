import { ref, computed } from 'vue';
import { useDynamicDocumentStore } from '@/stores/dynamicDocument';
import { useUserStore } from '@/stores/user';
import { showNotification } from '@/shared/notification_message';

export function useDocumentPermissions() {
  // Stores
  const store = useDynamicDocumentStore();
  const userStore = useUserStore();
  
  // Reactive state
  const availableClients = ref([]);
  const selectedVisibilityUsers = ref([]);
  const selectedUsabilityUsers = ref([]);
  const isPublicDocument = ref(false);
  const isLoadingClients = ref(false);
  const clientSearchQuery = ref('');

  // Check if current user is a lawyer
  const isLawyer = computed(() => {
    return userStore.getCurrentUser?.role === 'lawyer';
  });

  // Computed to filter clients based on search query
  const filteredClients = computed(() => {
    if (!Array.isArray(availableClients.value)) {
      return [];
    }

    if (!clientSearchQuery.value.trim()) {
      return availableClients.value;
    }

    const query = clientSearchQuery.value.toLowerCase().trim();
    return availableClients.value.filter(client => 
      client.full_name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query)
    );
  });

  // Computed to check if we have clients
  const hasAvailableClients = computed(() => {
    return Array.isArray(availableClients.value) && availableClients.value.length > 0;
  });

  // Computed to check if we have filtered clients
  const hasFilteredClients = computed(() => {
    return Array.isArray(filteredClients.value) && filteredClients.value.length > 0;
  });

  /**
   * Load available clients for permissions
   */
  const loadAvailableClients = async () => {
    if (!isLawyer.value) return;
    
    isLoadingClients.value = true;
    
    try {
      const clients = await store.fetchAvailableClients();
      availableClients.value = Array.isArray(clients) ? clients : [];
    } catch (error) {
      console.error('Error loading available clients:', error);
      await showNotification('Error al cargar clientes disponibles', 'error');
      availableClients.value = [];
    } finally {
      isLoadingClients.value = false;
    }
  };

  /**
   * Load complete permissions for a document
   */
  const loadDocumentPermissions = async (documentId) => {
    if (!documentId || !isLawyer.value) return;
    
         try {
       const permissionsData = await store.fetchDocumentPermissions(documentId);
       
       // Initialize permissions with the fetched data
       initializeExistingPermissions(permissionsData);
     } catch (error) {
       console.error('Error loading document permissions:', error);
       // Still initialize with the basic document data if available
       initializeExistingPermissions(store.selectedDocument);
     }
  };

  /**
   * Initialize permissions from permissions data
   */
     const initializeExistingPermissions = (permissionsData) => {
     if (!permissionsData || !isLawyer.value) {
       return;
     }
     
     // Reset permissions to default state first
     selectedVisibilityUsers.value = [];
     selectedUsabilityUsers.value = [];
     isPublicDocument.value = false;
     
     // Initialize public access state
     if (typeof permissionsData.is_public === 'boolean') {
       isPublicDocument.value = permissionsData.is_public;
     }
     
     // Only initialize individual permissions if document is not public
     if (!isPublicDocument.value) {
       // Initialize visibility permissions
       if (permissionsData.visibility_permissions && Array.isArray(permissionsData.visibility_permissions)) {
         const filtered = permissionsData.visibility_permissions
           .filter(permission => permission.user_id && permission.email && permission.full_name);
         
         selectedVisibilityUsers.value = filtered.map(permission => ({
           id: permission.user_id,
           user_id: permission.user_id,
           email: permission.email,
           full_name: permission.full_name
         }));
       }
       
       // Initialize usability permissions
       if (permissionsData.usability_permissions && Array.isArray(permissionsData.usability_permissions)) {
         const filtered = permissionsData.usability_permissions
           .filter(permission => permission.user_id && permission.email && permission.full_name);
         
         selectedUsabilityUsers.value = filtered.map(permission => ({
           id: permission.user_id,
           user_id: permission.user_id,
           email: permission.email,
           full_name: permission.full_name
         }));
       }
     }
   };

  /**
   * Toggle visibility permission for a user
   */
  const toggleVisibilityPermission = (user) => {
    const index = selectedVisibilityUsers.value.findIndex(u => u.id === user.id);
    
    if (index >= 0) {
      // Remove from visibility and also from usability (cascade removal)
      selectedVisibilityUsers.value.splice(index, 1);
      const usabilityIndex = selectedUsabilityUsers.value.findIndex(u => u.id === user.id);
      if (usabilityIndex >= 0) {
        selectedUsabilityUsers.value.splice(usabilityIndex, 1);
      }
    } else {
      // Add to visibility
      selectedVisibilityUsers.value.push(user);
    }
  };

  /**
   * Toggle usability permission for a user
   */
  const toggleUsabilityPermission = (user) => {
    const hasVisibility = selectedVisibilityUsers.value.some(u => u.id === user.id);
    
    if (!hasVisibility) {
      // Must have visibility first
      showNotification('El usuario debe tener permisos de visualización primero', 'warning');
      return;
    }
    
    const index = selectedUsabilityUsers.value.findIndex(u => u.id === user.id);
    
    if (index >= 0) {
      selectedUsabilityUsers.value.splice(index, 1);
    } else {
      selectedUsabilityUsers.value.push(user);
    }
  };

  /**
   * Check if user has visibility permission
   */
     const hasVisibilityPermission = (user) => {
     if (!user) return false;
     return selectedVisibilityUsers.value.some(u => u.id === user.id || u.user_id === user.user_id);
   };

  /**
   * Check if user has usability permission
   */
  const hasUsabilityPermission = (user) => {
    if (!user) return false;
    return selectedUsabilityUsers.value.some(u => u.id === user.id || u.user_id === user.user_id);
  };

  /**
   * Toggle public access
   */
  const togglePublicAccess = () => {
    isPublicDocument.value = !isPublicDocument.value;
    
    if (isPublicDocument.value) {
      // Clear all individual permissions when making public
      selectedVisibilityUsers.value = [];
      selectedUsabilityUsers.value = [];
    }
  };

  /**
   * Get permissions data for saving
   */
  const getPermissionsData = () => {
    if (!isLawyer.value) return {};
    
    return {
      is_public: isPublicDocument.value,
      visibility_user_ids: isPublicDocument.value ? [] : selectedVisibilityUsers.value.map(user => user.user_id),
      usability_user_ids: isPublicDocument.value ? [] : selectedUsabilityUsers.value.map(user => user.user_id)
    };
  };

  /**
   * Initialize permissions (main entry point)
   */
  const initializePermissions = async (document) => {
    if (!isLawyer.value) return;
    
    await loadAvailableClients();
    
    // Load complete permissions if editing an existing document
    if (document?.id) {
      await loadDocumentPermissions(document.id);
    }
  };

  return {
    // State
    availableClients,
    selectedVisibilityUsers,
    selectedUsabilityUsers,
    isPublicDocument,
    isLoadingClients,
    clientSearchQuery,
    
    // Computed
    isLawyer,
    filteredClients,
    hasAvailableClients,
    hasFilteredClients,
    
    // Methods
    loadAvailableClients,
    loadDocumentPermissions,
    initializeExistingPermissions,
    toggleVisibilityPermission,
    toggleUsabilityPermission,
    hasVisibilityPermission,
    hasUsabilityPermission,
    togglePublicAccess,
    getPermissionsData,
    initializePermissions
  };
} 