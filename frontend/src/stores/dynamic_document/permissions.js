import {
  get_request,
  create_request,
} from "../services/request_http";

/**
 * Permissions management actions
 */
export const permissionActions = {
  /**
   * Fetch available clients for document permissions
   * @returns {Promise<Array>} List of available clients
   */
  async fetchAvailableClients() {
    try {
      const response = await get_request('dynamic-documents/permissions/clients/');
      
      // Extract the clients array from the response and normalize the structure
      const clientsData = response.data?.clients || [];
      const normalizedClients = clientsData.map(client => ({
        id: client.user_id, // Normalize user_id to id
        user_id: client.user_id,
        email: client.email,
        full_name: client.full_name,
        role: client.role,
      }));
      
      return normalizedClients;
    } catch (error) {
      console.error("Error fetching available clients:", error);
      throw error;
    }
  },

  /**
   * Fetch complete permissions for a specific document
   * @param {number|string} documentId - The document ID
   * @returns {Promise<Object>} Complete permissions data
   */
  async fetchDocumentPermissions(documentId) {
    try {
      const response = await get_request(`dynamic-documents/${documentId}/permissions/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching permissions for document ${documentId}:`, error);
      throw error;
    }
  },

  /**
   * Fetch available roles for document permissions
   * @returns {Promise<Array>} List of available roles
   */
  async fetchAvailableRoles() {
    try {
      const response = await get_request('dynamic-documents/permissions/roles/');
      return response.data;
    } catch (error) {
      console.error("Error fetching available roles:", error);
      throw error;
    }
  },

  /**
   * Manage document permissions (unified endpoint)
   * Replaces all permissions with the provided data
   * @param {number|string} documentId - The document ID
   * @param {Object} permissionsData - Complete permissions configuration
   * @param {boolean} permissionsData.is_public - Whether document is public
   * @param {Object} permissionsData.visibility - Visibility permissions
   * @param {Array<string>} permissionsData.visibility.roles - Roles with visibility access
   * @param {Array<number>} permissionsData.visibility.user_ids - User IDs with visibility access
   * @param {Object} permissionsData.usability - Usability permissions
   * @param {Array<string>} permissionsData.usability.roles - Roles with usability access
   * @param {Array<number>} permissionsData.usability.user_ids - User IDs with usability access
   * @returns {Promise<Object>} Response data
   */
  async manageDocumentPermissions(documentId, permissionsData) {
    try {
      const response = await create_request(`dynamic-documents/${documentId}/permissions/manage/`, permissionsData);
      return response.data;
    } catch (error) {
      console.error(`Error managing permissions for document ${documentId}:`, error);
      throw error;
    }
  },
};