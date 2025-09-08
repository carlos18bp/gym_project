/**
 * Vue composable for managing document relationships
 * 
 * Provides a reactive interface for managing bidirectional document relationships
 * with comprehensive loading states and error handling. Acts as a bridge between
 * Vue components and the relationships store.
 * 
 * Features:
 * - Reactive data management with Vue 3 composition API
 * - Granular loading states for different operations
 * - Automatic error handling and propagation
 * - Optimized batch loading capabilities
 * - Utility functions for relationship validation
 * 
 * Usage:
 * ```javascript
 * import { useDocumentRelationships } from '@/composables/useDocumentRelationships'
 * 
 * const { 
 *   availableDocuments, 
 *   relatedDocuments, 
 *   createRelationship,
 *   deleteRelationship,
 *   loadAllData 
 * } = useDocumentRelationships(documentId)
 * ```
 * 
 * @param {number} documentId - The ID of the document to manage relationships for
 * @returns {Object} Reactive state and methods for relationship management
 */

import { ref } from 'vue'
import { 
  documentRelationshipsActions
} from '@/stores/dynamic_document/relationships'

export function useDocumentRelationships(documentId) {
  // Reactive state
  const availableDocuments = ref([])
  const relatedDocuments = ref([])
  const relationships = ref([])
  
  // Loading states
  const isLoading = ref(false)
  const isLoadingAvailable = ref(false)
  const isLoadingRelated = ref(false)
  const isLoadingRelationships = ref(false)

  /**
   * Load documents available for creating relationships
   */
  const loadAvailableDocuments = async () => {
    if (!documentId) return

    isLoadingAvailable.value = true
    try {
      availableDocuments.value = await documentRelationshipsActions.getAvailableDocumentsForRelationship(documentId)
    } catch (error) {
      console.error('Error loading available documents:', error)
      availableDocuments.value = []
      throw error
    } finally {
      isLoadingAvailable.value = false
    }
  }

  /**
   * Load documents that are already related to the current document
   */
  const loadRelatedDocuments = async () => {
    if (!documentId) return

    isLoadingRelated.value = true
    try {
      relatedDocuments.value = await documentRelationshipsActions.getRelatedDocuments(documentId)
    } catch (error) {
      console.error('Error loading related documents:', error)
      relatedDocuments.value = []
      throw error
    } finally {
      isLoadingRelated.value = false
    }
  }

  /**
   * Load relationship metadata for the current document
   */
  const loadRelationships = async () => {
    if (!documentId) return

    isLoadingRelationships.value = true
    try {
      relationships.value = await documentRelationshipsActions.getDocumentRelationships(documentId)
    } catch (error) {
      console.error('Error loading relationships:', error)
      relationships.value = []
      throw error
    } finally {
      isLoadingRelationships.value = false
    }
  }

  /**
   * Create a new relationship between documents
   */
  const createRelationship = async (relationshipData) => {
    isLoading.value = true
    try {
      return await documentRelationshipsActions.createDocumentRelationship(relationshipData)
    } catch (error) {
      console.error('Error creating relationship:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }


  /**
   * Delete a relationship
   */
  const deleteRelationship = async (relationshipId) => {
    isLoading.value = true
    try {
      return await documentRelationshipsActions.deleteDocumentRelationship(relationshipId)
    } catch (error) {
      console.error('Error deleting relationship:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }


  /**
   * Find the relationship object between two documents
   * 
   * @param {number} sourceDocId - ID of the first document
   * @param {number} targetDocId - ID of the second document
   * @returns {Object|undefined} The relationship object if found, undefined otherwise
   */
  const findRelationship = (sourceDocId, targetDocId) => {
    return relationships.value.find(rel => 
      (rel.source_document === sourceDocId && rel.target_document === targetDocId) ||
      (rel.source_document === targetDocId && rel.target_document === sourceDocId)
    )
  }

  /**
   * Check if two documents have a relationship
   * 
   * @param {number} sourceDocId - ID of the first document
   * @param {number} targetDocId - ID of the second document
   * @returns {boolean} True if documents are related, false otherwise
   */
  const areDocumentsRelated = (sourceDocId, targetDocId) => {
    return !!findRelationship(sourceDocId, targetDocId)
  }

  /**
   * Load all data for the document
   */
  const loadAllData = async () => {
    await Promise.all([
      loadAvailableDocuments(),
      loadRelatedDocuments(),
      loadRelationships()
    ])
  }

  return {
    // State
    availableDocuments,
    relatedDocuments,
    relationships,
    
    // Loading states
    isLoading,
    isLoadingAvailable,
    isLoadingRelated,
    isLoadingRelationships,
    
    // Methods
    loadAvailableDocuments,
    loadRelatedDocuments,
    loadRelationships,
    loadAllData,
    createRelationship,
    deleteRelationship,
    
    // Utilities
    findRelationship,
    areDocumentsRelated
  }
}
