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
        full_name: client.full_name
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
   * Toggle public access for a document
   * @param {number|string} documentId - The document ID
   * @returns {Promise<Object>} Response data
   */
  async toggleDocumentPublicAccess(documentId) {
    try {
      const response = await create_request(`dynamic-documents/${documentId}/permissions/public/toggle/`, {});
      return response.data;
    } catch (error) {
      console.error(`Error toggling public access for document ${documentId}:`, error);
      throw error;
    }
  },

  /**
   * Grant visibility permissions to users
   * @param {number|string} documentId - The document ID
   * @param {Array<number>} userIds - Array of user IDs to grant permission to
   * @returns {Promise<Object>} Response data
   */
  async grantVisibilityPermissions(documentId, userIds) {
    try {
      const response = await create_request(`dynamic-documents/${documentId}/permissions/visibility/grant/`, {
        user_ids: userIds
      });
      return response.data;
    } catch (error) {
      console.error(`Error granting visibility permissions for document ${documentId}:`, error);
      throw error;
    }
  },

  /**
   * Grant usability permissions to users
   * @param {number|string} documentId - The document ID
   * @param {Array<number>} userIds - Array of user IDs to grant permission to
   * @returns {Promise<Object>} Response data
   */
  async grantUsabilityPermissions(documentId, userIds) {
    try {
      const response = await create_request(`dynamic-documents/${documentId}/permissions/usability/grant/`, {
        user_ids: userIds
      });
      return response.data;
    } catch (error) {
      console.error(`Error granting usability permissions for document ${documentId}:`, error);
      throw error;
    }
  },
};