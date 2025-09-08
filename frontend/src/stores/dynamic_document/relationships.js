import {
  get_request,
  create_request,
  delete_request,
} from "../services/request_http";

/**
 * Document Relationships Store
 * 
 * Provides centralized actions for managing bidirectional document relationships.
 * All operations enforce business rules such as user ownership validation and
 * completed document state requirements.
 * 
 * Features:
 * - Bidirectional relationship management
 * - User ownership and permission validation
 * - Completed document state filtering
 * - Optimized data fetching with error handling
 * 
 * Security:
 * - All requests require authentication
 * - Only user-owned completed documents are accessible
 * - Backend validates all operations
 * 
 * @module DocumentRelationshipsStore
 */
export const documentRelationshipsActions = {
  /**
   * Get all relationships for a specific document
   * @param {number} documentId - The ID of the document
   * @returns {Promise<Array>} Array of relationship objects
   */
  async getDocumentRelationships(documentId) {
    try {
      const response = await get_request(`dynamic-documents/${documentId}/relationships/`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching document relationships:', error);
      throw error;
    }
  },

  /**
   * Get all documents related to a specific document
   * @param {number} documentId - The ID of the document
   * @returns {Promise<Array>} Array of related document objects
   */
  async getRelatedDocuments(documentId) {
    try {
      const response = await get_request(`dynamic-documents/${documentId}/related-documents/`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching related documents:', error);
      throw error;
    }
  },

  /**
   * Get all documents available for creating relationships
   * @param {number} documentId - The ID of the source document
   * @returns {Promise<Array>} Array of available document objects
   */
  async getAvailableDocumentsForRelationship(documentId) {
    try {
      const response = await get_request(`dynamic-documents/${documentId}/available-for-relationship/`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching available documents:', error);
      throw error;
    }
  },

  /**
   * Create a new relationship between documents
   * @param {Object} relationshipData - The relationship data
   * @param {number} relationshipData.source_document - Source document ID
   * @param {number} relationshipData.target_document - Target document ID
   * @returns {Promise<Object>} Created relationship object
   */
  async createDocumentRelationship(relationshipData) {
    try {
      const response = await create_request('dynamic-documents/relationships/create/', relationshipData);
      return response.data;
    } catch (error) {
      console.error('Error creating document relationship:', error);
      throw error;
    }
  },

  /**
   * Delete a relationship between documents
   * @param {number} relationshipId - The ID of the relationship to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteDocumentRelationship(relationshipId) {
    try {
      const response = await delete_request(`dynamic-documents/relationships/${relationshipId}/delete/`);
      // Handle both 200 OK and 204 No Content responses
      return response.status === 200 || response.status === 204;
    } catch (error) {
      console.error('Error deleting document relationship:', error);
      // If it's a network error but the operation might have succeeded,
      // we could add additional logic here to verify
      throw error;
    }
  }
};

