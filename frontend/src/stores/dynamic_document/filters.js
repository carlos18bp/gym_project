/**
 * Filter-related getters for dynamic documents store
 */
export const filterGetters = {
  /**
   * Filter documents based on a search query
   * @param {object} state - Store state
   * @returns {function} - Function that takes a search query and returns filtered documents
   */
  filteredDocuments: (state) => (query, userStore) => {
    if (!query) return state.documents; // Return all documents if no search query is present

    const lowerQuery = query.toLowerCase();

    return state.documents.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(lowerQuery) || // Search in title
        doc.state.toLowerCase().includes(lowerQuery) || // Search in state
        (doc.assigned_to &&
          userStore &&
          (userStore
            .userById(doc.assigned_to)
            ?.first_name?.toLowerCase()
            .includes(lowerQuery) ||
            userStore
              .userById(doc.assigned_to)
              ?.last_name?.toLowerCase()
              .includes(lowerQuery) ||
            userStore
              .userById(doc.assigned_to)
              ?.email?.toLowerCase()
              .includes(lowerQuery) ||
            userStore
              .userById(doc.assigned_to)
              ?.identification?.toLowerCase()
              .includes(lowerQuery)))
      );
    });
  },

  /**
   * Filter documents by selected tags
   * @param {object} state - Store state
   * @returns {function} - Function that takes an array of tag IDs and returns filtered documents
   */
  filteredDocumentsByTags: (state) => (selectedTagIds) => {
    if (!selectedTagIds || selectedTagIds.length === 0) return state.documents;

    return state.documents.filter((doc) => {
      // Check if document has tags
      if (!doc.tags || doc.tags.length === 0) return false;

      // Check if document has any of the selected tags
      return doc.tags.some(tag => selectedTagIds.includes(tag.id));
    });
  },

  /**
   * Filter documents by both search query and selected tags
   * @param {object} state - Store state
   * @returns {function} - Function that takes search query, userStore, and tag IDs
   */
  filteredDocumentsBySearchAndTags: (state) => (query, userStore, selectedTagIds) => {
    let filteredDocs = state.documents;

    // Apply search filter first
    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredDocs = filteredDocs.filter((doc) => {
        return (
          doc.title.toLowerCase().includes(lowerQuery) ||
          doc.state.toLowerCase().includes(lowerQuery) ||
          (doc.assigned_to &&
            userStore &&
            (userStore
              .userById(doc.assigned_to)
              ?.first_name?.toLowerCase()
              .includes(lowerQuery) ||
              userStore
                .userById(doc.assigned_to)
                ?.last_name?.toLowerCase()
                .includes(lowerQuery) ||
              userStore
                .userById(doc.assigned_to)
                ?.email?.toLowerCase()
                .includes(lowerQuery) ||
              userStore
                .userById(doc.assigned_to)
                ?.identification?.toLowerCase()
                .includes(lowerQuery)))
        );
      });
    }

    // Apply tag filter
    if (selectedTagIds && selectedTagIds.length > 0) {
      filteredDocs = filteredDocs.filter((doc) => {
        if (!doc.tags || doc.tags.length === 0) return false;
        return doc.tags.some(tag => selectedTagIds.includes(tag.id));
      });
    }

    return filteredDocs;
  },
};