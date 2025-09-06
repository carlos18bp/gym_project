import { ref, computed } from 'vue';
import { useDynamicDocumentStore } from '@/stores/dynamic_document';
import { useUserStore } from '@/stores/auth/user';
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
  
  // New state for role-based permissions
  const availableRoles = ref([]);
  const selectedVisibilityRoles = ref([]);
  const selectedUsabilityRoles = ref([]);
  const isLoadingRoles = ref(false);
  const permissionMode = ref('individual'); // 'individual' or 'role'

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

  // Computed to check if we have available roles
  const hasAvailableRoles = computed(() => {
    return Array.isArray(availableRoles.value) && availableRoles.value.length > 0;
  });

  // Computed to get assignable roles (only roles that can be granted permissions)
  const assignableRoles = computed(() => {
    if (!Array.isArray(availableRoles.value)) {
      return [];
    }
    return availableRoles.value.filter(role => role.can_be_granted_permissions);
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
   * Load available roles for permissions
   */
  const loadAvailableRoles = async () => {
    if (!isLawyer.value || isLoadingRoles.value) return;
    
    isLoadingRoles.value = true;
    try {
      const rolesData = await store.fetchAvailableRoles();
      availableRoles.value = rolesData?.roles || [];
    } catch (error) {
      console.error('Error loading available roles:', error);
      
      // Datos de prueba temporales para desarrollo
      console.log('Usando datos de prueba para roles...');
      availableRoles.value = [
        {
          code: "client",
          display_name: "Client",
          description: "Cliente regular del sistema",
          user_count: 25,
          has_automatic_access: false,
          can_be_granted_permissions: true
        },
        {
          code: "corporate_client",
          display_name: "Corporate Client",
          description: "Cliente corporativo con necesidades empresariales",
          user_count: 8,
          has_automatic_access: false,
          can_be_granted_permissions: true
        },
        {
          code: "basic",
          display_name: "Basic",
          description: "Usuario con acceso básico limitado",
          user_count: 12,
          has_automatic_access: false,
          can_be_granted_permissions: true
        },
        {
          code: "lawyer",
          display_name: "Lawyer",
          description: "Abogado con acceso completo automático",
          user_count: 5,
          has_automatic_access: true,
          can_be_granted_permissions: false
        }
      ];
      
      await showNotification('Usando datos de prueba para roles (desarrollo)', 'warning');
    } finally {
      isLoadingRoles.value = false;
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
   * Toggle visibility permission for a role
   */
  const toggleVisibilityRolePermission = (role) => {
    if (!role) return;
    
    const index = selectedVisibilityRoles.value.findIndex(r => r.code === role.code);
    
    if (index >= 0) {
      selectedVisibilityRoles.value.splice(index, 1);
      // Also remove from usability if it was there
      const usabilityIndex = selectedUsabilityRoles.value.findIndex(r => r.code === role.code);
      if (usabilityIndex >= 0) {
        selectedUsabilityRoles.value.splice(usabilityIndex, 1);
      }
    } else {
      selectedVisibilityRoles.value.push(role);
    }
  };

  /**
   * Toggle usability permission for a role
   */
  const toggleUsabilityRolePermission = (role) => {
    if (!role) return;
    
    const hasVisibility = selectedVisibilityRoles.value.some(r => r.code === role.code);
    
    if (!hasVisibility) {
      showNotification('El rol debe tener permisos de visualización primero', 'warning');
      return;
    }
    
    const index = selectedUsabilityRoles.value.findIndex(r => r.code === role.code);
    
    if (index >= 0) {
      selectedUsibilityRoles.value.splice(index, 1);
    } else {
      selectedUsabilityRoles.value.push(role);
    }
  };

  /**
   * Check if role has visibility permission
   */
  const hasVisibilityRolePermission = (role) => {
    if (!role) return false;
    return selectedVisibilityRoles.value.some(r => r.code === role.code);
  };

  /**
   * Check if role has usability permission
   */
  const hasUsabilityRolePermission = (role) => {
    if (!role) return false;
    return selectedUsibilityRoles.value.some(r => r.code === role.code);
  };

  /**
   * Switch permission mode between individual and role-based
   */
  const switchPermissionMode = (mode) => {
    permissionMode.value = mode;
    
    if (mode === 'role') {
      // Clear individual selections when switching to role mode
      selectedVisibilityUsers.value = [];
      selectedUsabilityUsers.value = [];
    } else {
      // Clear role selections when switching to individual mode
      selectedVisibilityRoles.value = [];
      selectedUsabilityRoles.value = [];
    }
  };

  /**
   * Get permissions data for saving
   */
  const getPermissionsData = () => {
    if (!isLawyer.value) return {};
    
    const baseData = {
      is_public: isPublicDocument.value,
      permission_mode: permissionMode.value
    };

    if (isPublicDocument.value) {
      return {
        ...baseData,
        visibility_user_ids: [],
        usability_user_ids: [],
        visibility_roles: [],
        usability_roles: []
      };
    }

    if (permissionMode.value === 'role') {
      return {
        ...baseData,
        visibility_user_ids: [],
        usability_user_ids: [],
        visibility_roles: selectedVisibilityRoles.value.map(role => role.code),
        usability_roles: selectedUsabilityRoles.value.map(role => role.code)
      };
    } else {
      return {
        ...baseData,
        visibility_user_ids: selectedVisibilityUsers.value.map(user => user.user_id),
        usability_user_ids: selectedUsabilityUsers.value.map(user => user.user_id),
        visibility_roles: [],
        usability_roles: []
      };
    }
  };

  /**
   * Initialize permissions (main entry point)
   */
  const initializePermissions = async (document) => {
    if (!isLawyer.value) return;
    
    // Load both clients and roles in parallel
    await Promise.all([
      loadAvailableClients(),
      loadAvailableRoles()
    ]);
    
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
    
    // New role-based state
    availableRoles,
    selectedVisibilityRoles,
    selectedUsabilityRoles,
    isLoadingRoles,
    permissionMode,
    
    // Computed
    isLawyer,
    filteredClients,
    hasAvailableClients,
    hasFilteredClients,
    hasAvailableRoles,
    assignableRoles,
    
    // Methods
    loadAvailableClients,
    loadAvailableRoles,
    loadDocumentPermissions,
    initializeExistingPermissions,
    toggleVisibilityPermission,
    toggleUsabilityPermission,
    hasVisibilityPermission,
    hasUsabilityPermission,
    
    // New role-based methods
    toggleVisibilityRolePermission,
    toggleUsabilityRolePermission,
    hasVisibilityRolePermission,
    hasUsabilityRolePermission,
    switchPermissionMode,
    
    togglePublicAccess,
    getPermissionsData,
    initializePermissions
  };
} 