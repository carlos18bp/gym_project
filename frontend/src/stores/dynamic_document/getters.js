/**
 * Getters for dynamic documents store
 */
export const getters = {
  /**
   * Get document by its ID from cache or documents list
   * @returns {Function} - Function to get document by ID
   */
  documentById: (state) => {
    return (documentId) => {
      // First check the cache for the full document details
      if (state.documentCache[documentId]) {
        return state.documentCache[documentId];
      }
      // Otherwise look in the list
      return state.documents.find((doc) => doc.id == documentId) || null;
    }
  },

  /**
   * Get tag by its ID
   * @returns {Function} - Function to get tag by ID
   */
  tagById: (state) => {
    return (tagId) => {
      return state.tags.find((tag) => tag.id == tagId) || null;
    }
  },

  /**
   * Get all tags sorted by name
   * @returns {Array} - List of tags sorted alphabetically
   */
  sortedTags: (state) => {
    return [...state.tags].sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * Get all published documents with no client assignment
   * @returns {Array} - List of published unassigned documents
   */
  publishedDocumentsUnassigned: (state) => {
    return state.documents.filter(
      (doc) => doc.state === "Published" && !doc.assigned_to
    );
  },

  /**
   * Get all draft or published documents with no client assignment
   * @returns {Array} - List of draft or published unassigned documents
   */
  draftAndPublishedDocumentsUnassigned: (state) => {
    return state.documents.filter(
      (doc) =>
        (doc.state === "Draft" || doc.state === "Published") &&
        !doc.assigned_to
    );
  },

  /**
   * Get all documents in progress state
   * @returns {Array} - List of in-progress documents
   */
  progressDocumentsByClient: (state) => {
    return state.documents.filter(
      (doc) => doc.state === "Progress"
    );
  },

  /**
   * Get all documents pending signature
   * @returns {Array} - List of documents pending signature
   */
  pendingSignatureDocuments: (state) => {
    return state.documents.filter(
      (doc) => doc.state === "PendingSignatures"
    );
  },

  /**
   * Get all fully signed documents
   * @returns {Array} - List of fully signed documents
   */
  fullySignedDocuments: (state) => {
    return state.documents.filter(
      (doc) => doc.state === "FullySigned"
    );
  },

  /**
   * Get all completed documents
   * @returns {Array} - List of completed documents
   */
  completedDocumentsByClient: (state) => {
    return state.documents.filter(
      (doc) => doc.state === "Completed"
    );
  },

  /**
   * Get all in-progress and completed documents for a specific client
   * @param {object} state - Store state
   * @returns {function} - Function that takes a client ID and returns filtered documents
   */
  progressAndCompletedDocumentsByClient: (state) => (clientId) => {
    if (!clientId) {
      return [];
    }

    const filteredDocs = state.documents.filter(
      (doc) => {
        const docClientId = doc.assigned_to ? String(doc.assigned_to) : null;
        const queryClientId = String(clientId);
        
        const matches = docClientId === queryClientId && 
                      (doc.state === "Progress" || doc.state === "Completed");
        
        return matches;
      }
    );
    
    return filteredDocs;
  },

  /**
   * Get documents for a specific client
   * @param {object} state - Store state
   * @returns {function} - Function that takes a client ID and returns their documents
   */
  documentsByClient: (state) => (clientId) => {
    if (clientId) {
      const filteredDocs = state.documents.filter((doc) => {
        return doc.client_id === parseInt(clientId);
      });
      return filteredDocs;
    }
    return [];
  },

  /**
   * Get documents created by a specific lawyer
   * @param {object} state - Store state
   * @returns {function} - Function that takes a lawyer ID and returns their documents
   */
  getDocumentsByLawyerId: (state) => (lawyerId) => {
    if (!lawyerId) return [];
    return state.documents.filter(doc => 
      doc.created_by === parseInt(lawyerId) && 
      (doc.state === "Draft" || doc.state === "Published")
    );
  },
};