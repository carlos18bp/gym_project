/**
 * Centralized state definition for dynamic documents store
 */
export const initialState = () => ({
  // Document management
  documents: [], // List of dynamic documents
  selectedDocument: null, // Currently selected document
  dataLoaded: false, // Flag to indicate if documents have been fetched
  lastUpdatedDocumentId: null, // Track the last updated document ID
  isLoading: false, // Track loading state
  lastFetchTime: null, // Last time documents were fetched
  documentCache: {}, // Cache for individual document details
  
  // Tag management state
  tags: [], // List of available tags
  tagsLoaded: false, // Flag to indicate if tags have been fetched
  isLoadingTags: false, // Track loading state for tags
  
  // Pagination state
  pagination: {
    currentPage: 1,
    itemsPerPage: 20,
    totalItems: 0,
    totalPages: 0,
    hasMore: false
  },
});