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
  
  // Role-based permissions state
  const availableRoles = ref([]);
  const selectedRolesVisibility = ref([]);
  const selectedRolesUsability = ref([]);
  const isLoadingRoles = ref(false);


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

  // Computed to check if we have roles
  const hasAvailableRoles = computed(() => {
    return Array.isArray(availableRoles.value) && availableRoles.value.length > 0;
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
    if (!isLawyer.value) return;
    
    isLoadingRoles.value = true;
    
    try {
      const rolesData = await store.fetchAvailableRoles();
      availableRoles.value = Array.isArray(rolesData.roles) ? rolesData.roles : [];
    } catch (error) {
      console.error('Error loading available roles:', error);
      await showNotification('Error al cargar roles disponibles', 'error');
      availableRoles.value = [];
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
   *
   * This method now distinguishes between role-based permissions and
   * individual user permissions. Users that belong to an active role
   * (reported in permissionsData.active_roles) are NOT added to the
   * selectedVisibilityUsers/selectedUsabilityUsers lists, so that
   * unchecking a role truly removes its permissions.
   */
  const initializeExistingPermissions = (permissionsData) => {
    if (!permissionsData || !isLawyer.value) {
      return;
    }
    
    // Reset permissions to default state first
    selectedVisibilityUsers.value = [];
    selectedUsabilityUsers.value = [];
    selectedRolesVisibility.value = [];
    selectedRolesUsability.value = [];
    isPublicDocument.value = false;
    
    // Initialize public access state
    if (typeof permissionsData.is_public === 'boolean') {
      isPublicDocument.value = permissionsData.is_public;
    }
    
    // Only initialize permissions if document is not public
    if (!isPublicDocument.value) {
      // Initialize role-based permissions from active_roles
      let activeVisibilityRoles = [];
      let activeUsabilityRoles = [];
      
      if (permissionsData.active_roles) {
        // Set visibility roles
        if (
          permissionsData.active_roles.visibility_roles &&
          Array.isArray(permissionsData.active_roles.visibility_roles)
        ) {
          selectedRolesVisibility.value = [
            ...permissionsData.active_roles.visibility_roles,
          ];
          activeVisibilityRoles = [...permissionsData.active_roles.visibility_roles];
        }
        
        // Set usability roles
        if (
          permissionsData.active_roles.usability_roles &&
          Array.isArray(permissionsData.active_roles.usability_roles)
        ) {
          selectedRolesUsability.value = [
            ...permissionsData.active_roles.usability_roles,
          ];
          activeUsabilityRoles = [...permissionsData.active_roles.usability_roles];
        }
      }

      // Helper to find a client by user_id using availableClients list
      const findClientByUserId = (userId) => {
        if (!Array.isArray(availableClients.value)) {
          return null;
        }
        return (
          availableClients.value.find(
            (client) => client.user_id === userId || client.id === userId
          ) || null
        );
      };

      // Initialize individual visibility permissions (excluding those
      // that belong to active visibility roles)
      if (
        permissionsData.visibility_permissions &&
        Array.isArray(permissionsData.visibility_permissions)
      ) {
        const filtered = permissionsData.visibility_permissions
          .filter(
            (permission) =>
              permission.user_id && permission.email && permission.full_name
          )
          .filter((permission) => {
            if (!activeVisibilityRoles.length) {
              return true;
            }
            const client = findClientByUserId(permission.user_id);
            if (!client || !client.role) {
              return true;
            }
            // Skip users whose role is already covered by an active role
            return !activeVisibilityRoles.includes(client.role);
          });

        selectedVisibilityUsers.value = filtered.map((permission) => ({
          id: permission.user_id,
          user_id: permission.user_id,
          email: permission.email,
          full_name: permission.full_name,
        }));
      }

      // Initialize individual usability permissions (excluding those
      // that belong to active usability roles)
      if (
        permissionsData.usability_permissions &&
        Array.isArray(permissionsData.usability_permissions)
      ) {
        const filtered = permissionsData.usability_permissions
          .filter(
            (permission) =>
              permission.user_id && permission.email && permission.full_name
          )
          .filter((permission) => {
            if (!activeUsabilityRoles.length) {
              return true;
            }
            const client = findClientByUserId(permission.user_id);
            if (!client || !client.role) {
              return true;
            }
            // Skip users whose role is already covered by an active role
            return !activeUsabilityRoles.includes(client.role);
          });

        selectedUsabilityUsers.value = filtered.map((permission) => ({
          id: permission.user_id,
          user_id: permission.user_id,
          email: permission.email,
          full_name: permission.full_name,
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
      selectedRolesVisibility.value = [];
      selectedRolesUsability.value = [];
    }
  };

  /**
   * Toggle visibility permission for a role
   *
   * When a role is enabled, all clients with that role are marked as having
   * visibility in the UI. When the role is disabled, all corresponding
   * client permissions (visibility and usability) are removed. This ensures
   * that unchecking a role truly revokes access for that role.
   */
  const toggleRoleVisibilityPermission = (roleCode) => {
    const index = selectedRolesVisibility.value.indexOf(roleCode);

    const getClientUserIdsForRole = () => {
      if (!Array.isArray(availableClients.value)) {
        return [];
      }
      return availableClients.value
        .filter((client) => client.role === roleCode)
        .map((client) => client.user_id ?? client.id)
        .filter(Boolean);
    };

    if (index >= 0) {
      // Removing role: also remove corresponding client permissions
      selectedRolesVisibility.value.splice(index, 1);
      const usabilityIndex = selectedRolesUsability.value.indexOf(roleCode);
      if (usabilityIndex >= 0) {
        selectedRolesUsability.value.splice(usabilityIndex, 1);
      }

      const idsToRemove = new Set(getClientUserIdsForRole());

      if (idsToRemove.size > 0) {
        selectedVisibilityUsers.value = selectedVisibilityUsers.value.filter(
          (user) => !idsToRemove.has(user.user_id ?? user.id)
        );
        selectedUsabilityUsers.value = selectedUsabilityUsers.value.filter(
          (user) => !idsToRemove.has(user.user_id ?? user.id)
        );
      }
    } else {
      // Adding role: mark all clients with this role as having visibility
      selectedRolesVisibility.value.push(roleCode);

      const idsForRole = new Set(getClientUserIdsForRole());
      if (idsForRole.size > 0) {
        const existingIds = new Set(
          selectedVisibilityUsers.value.map((user) => user.user_id ?? user.id)
        );

        availableClients.value
          .filter((client) => client.role === roleCode)
          .forEach((client) => {
            const userId = client.user_id ?? client.id;
            if (userId && !existingIds.has(userId)) {
              selectedVisibilityUsers.value.push({
                id: userId,
                user_id: userId,
                email: client.email,
                full_name: client.full_name,
              });
            }
          });
      }
    }
  };

  /**
   * Toggle usability permission for a role
   */
  const toggleRoleUsabilityPermission = (roleCode) => {
    
    const hasVisibility = selectedRolesVisibility.value.includes(roleCode);
    
    if (!hasVisibility) {
      // Must have visibility first
      showNotification('El rol debe tener permisos de visualización primero', 'warning');
      return;
    }
    
    const index = selectedRolesUsability.value.indexOf(roleCode);
    
    if (index >= 0) {
      selectedRolesUsability.value.splice(index, 1);
    } else {
      selectedRolesUsability.value.push(roleCode);
    }
  };

  /**
   * Check if role has visibility permission
   */
  const hasRoleVisibilityPermission = (roleCode) => {
    return selectedRolesVisibility.value.includes(roleCode);
  };

  /**
   * Check if role has usability permission
   */
  const hasRoleUsabilityPermission = (roleCode) => {
    return selectedRolesUsability.value.includes(roleCode);
  };

  /**
   * Get role display name by code
   */
  const getRoleDisplayName = (roleCode) => {
    const role = availableRoles.value.find(r => r.code === roleCode);
    return role ? role.display_name : roleCode;
  };

  /**
   * Get permissions data for saving (new unified format)
   */
  /**
   * Get permissions data with roles expanded to user IDs (for update endpoint)
   */
  const getPermissionsDataExpanded = () => {
    if (!isLawyer.value) return {};
    
    // Expand roles to user IDs
    const expandRolesToUserIds = (roles) => {
      if (!roles || roles.length === 0) return [];
      
      const userIds = new Set();
      
      roles.forEach(roleCode => {
        const usersWithRole = availableClients.value.filter(client => client.role === roleCode);
        usersWithRole.forEach(user => {
          userIds.add(user.user_id);
        });
      });
      
      return Array.from(userIds);
    };
    
    // Get user IDs from selected users
    const visibilityUserIds = selectedVisibilityUsers.value.map(user => user.user_id);
    const usabilityUserIds = selectedUsabilityUsers.value.map(user => user.user_id);
    
    // Expand roles to user IDs
    const visibilityRoleUserIds = expandRolesToUserIds(selectedRolesVisibility.value);
    const usabilityRoleUserIds = expandRolesToUserIds(selectedRolesUsability.value);
    
    // Combine and deduplicate
    const allVisibilityUserIds = [...new Set([...visibilityUserIds, ...visibilityRoleUserIds])];
    const allUsabilityUserIds = [...new Set([...usabilityUserIds, ...usabilityRoleUserIds])];
    
    return {
      is_public: isPublicDocument.value,
      visibility_user_ids: isPublicDocument.value ? [] : allVisibilityUserIds,
      usability_user_ids: isPublicDocument.value ? [] : allUsabilityUserIds
    };
  };


  const getPermissionsData = () => {
    if (!isLawyer.value) return {};
    
    return {
      is_public: isPublicDocument.value,
      visibility: {
        roles: isPublicDocument.value ? [] : selectedRolesVisibility.value,
        user_ids: isPublicDocument.value ? [] : selectedVisibilityUsers.value.map(user => user.user_id)
      },
      usability: {
        roles: isPublicDocument.value ? [] : selectedRolesUsability.value,
        user_ids: isPublicDocument.value ? [] : selectedUsabilityUsers.value.map(user => user.user_id)
      }
    };
  };

  /**
   * Initialize permissions (main entry point)
   */
  const initializePermissions = async (document) => {
    if (!isLawyer.value) return;
    
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
    availableRoles,
    selectedRolesVisibility,
    selectedRolesUsability,
    isLoadingRoles,
    
    // Computed
    isLawyer,
    filteredClients,
    hasAvailableClients,
    hasFilteredClients,
    hasAvailableRoles,
    
    // Methods
    loadAvailableClients,
    loadDocumentPermissions,
    initializeExistingPermissions,
    toggleVisibilityPermission,
    toggleUsabilityPermission,
    hasVisibilityPermission,
    hasUsabilityPermission,
    togglePublicAccess,
    toggleRoleVisibilityPermission,
    toggleRoleUsabilityPermission,
    hasRoleVisibilityPermission,
    hasRoleUsabilityPermission,
    getRoleDisplayName,
    getPermissionsData,
    getPermissionsDataExpanded,
    initializePermissions
  };
} 