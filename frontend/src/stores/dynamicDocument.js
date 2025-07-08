import { defineStore } from "pinia";
import {
  get_request,
  create_request,
  update_request,
  delete_request,
} from "./services/request_http";
import { downloadFile } from "@/shared/document_utils";
import { registerUserActivity, ACTION_TYPES } from "./activity_feed";

export const useDynamicDocumentStore = defineStore("dynamicDocument", {
  /**
   * Store state definition
   */
  state: () => ({
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
    pagination: {
      currentPage: 1,
      itemsPerPage: 20,
      totalItems: 0,
      totalPages: 0,
      hasMore: false
    },
  }),

  getters: {
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
  },

  actions: {
    /**
     * Initialize the store by fetching data if not already loaded or if data is stale
     * @param {boolean} forceRefresh - Whether to force a refresh of the data
     */
    async init(forceRefresh = false) {
      // Check if data is stale (older than 5 minutes)
      const isDataStale = !this.lastFetchTime || 
                         (Date.now() - this.lastFetchTime > 5 * 60 * 1000);
      
      // Load data if it's not loaded, it's stale, or a refresh is forced
      if (!this.dataLoaded || isDataStale || forceRefresh) {
        await this.fetchDocuments({ forceRefresh });
      }
      
      // Check localStorage for saved ID to highlight
      const savedId = localStorage.getItem('lastUpdatedDocumentId');
      if (savedId) {
        this.lastUpdatedDocumentId = parseInt(savedId);
      }
    },

    /**
     * Fetch documents with pagination support
     * 
     * @param {Object} options - Options for the request
     * @param {number} options.page - Page number to fetch
     * @param {number} options.limit - Items per page
     * @param {string} options.state - Filter by document state
     * @param {number} options.clientId - Filter by client ID
     * @param {number} options.lawyerId - Filter by lawyer ID
     * @param {boolean} options.forceRefresh - Whether to bypass cache
     * @param {boolean} options.append - Whether to append results instead of replacing
     * @returns {Promise<Object>} - Pagination data
     */
    async fetchDocuments(options = {}) {
      const { 
        page = 1, 
        limit = this.pagination.itemsPerPage,
        state = '',
        clientId = null,
        lawyerId = null,
        forceRefresh = false,
        append = false
      } = options;
      
      // Prevent multiple simultaneous requests
      if (this.isLoading) return;
      
      // Check if data was loaded recently (last 30 seconds) unless forced
      const recentlyLoaded = this.lastFetchTime && (Date.now() - this.lastFetchTime < 30 * 1000);
      if (recentlyLoaded && !forceRefresh && this.dataLoaded) return;
      
      this.isLoading = true;
      
      try {
        // Construct query parameters
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('limit', limit);
        
        if (state) params.append('state', state);
        if (clientId) params.append('client_id', clientId);
        if (lawyerId) params.append('lawyer_id', lawyerId);
        
        const endpoint = `dynamic-documents/?${params.toString()}`;
        
        const response = await get_request(endpoint);
        let responseData = response.data;
        
        // Handle different API response formats
        // Adapt for current API that might not support pagination yet
        if (!responseData.items && Array.isArray(responseData)) {
          responseData = { 
            items: responseData, 
            totalItems: responseData.length, 
            totalPages: 1,
            currentPage: 1
          };
        }
        
        // Update pagination state
        this.pagination = {
          currentPage: page,
          itemsPerPage: limit,
          totalItems: responseData.totalItems || responseData.items.length,
          totalPages: responseData.totalPages || 1,
          hasMore: (responseData.totalPages && page < responseData.totalPages) || false
        };
        
        // Update documents list
        if (append && page > 1) {
          this.documents = [...this.documents, ...responseData.items];
        } else {
          this.documents = responseData.items || [];
        }
        
        this.dataLoaded = true;
        this.lastFetchTime = Date.now();
        
        return this.pagination;
      } catch (error) {
        console.error("Error fetching documents:", error);
        if (page === 1) {
          this.documents = [];
        }
        throw error;
      } finally {
        this.isLoading = false;
      }
    },
    
    /**
     * Load more documents (next page)
     * @returns {Promise<Object>} Pagination data
     */
    async loadMoreDocuments(options = {}) {
      if (!this.pagination.hasMore || this.isLoading) return;
      
      const nextPage = this.pagination.currentPage + 1;
      return this.fetchDocuments({
        ...options,
        page: nextPage,
        append: true
      });
    },
    
    /**
     * Fetch a single document by ID
     * @param {number|string} documentId - The document ID to fetch
     * @param {boolean} forceRefresh - Whether to bypass cache
     * @returns {Promise<Object>} The document data
     */
    async fetchDocumentById(documentId, forceRefresh = false) {
      // If it's already in the cache and we're not forcing a refresh, return from cache
      if (this.documentCache[documentId] && !forceRefresh) {
        return this.documentCache[documentId];
      }
      
      try {
        const response = await get_request(`dynamic-documents/${documentId}/`);
        const documentData = response.data;
        
        // Update the cache
        this.documentCache[documentId] = documentData;
        
        // Update in the main list if it exists there
        const existingIndex = this.documents.findIndex(doc => doc.id == documentId);
        if (existingIndex >= 0) {
          this.documents[existingIndex] = documentData;
        }
        
        return documentData;
      } catch (error) {
        console.error(`Error fetching document ID ${documentId}:`, error);
        throw error;
      }
    },

    /**
     * Create a new dynamic document
     * @param {Object} documentData - Data for the new document
     * @returns {Object} The created document data
     */
    async createDocument(documentData) {
      try {
        const response = await create_request("dynamic-documents/create/", documentData);
        
        // Add to the local data
        this.documents.unshift(response.data);
        
        // Update cache
        this.documentCache[response.data.id] = response.data;
        
        // Track for highlighting
        this.lastUpdatedDocumentId = response.data.id;
        localStorage.setItem('lastUpdatedDocumentId', response.data.id);
        
        // Register user activity
        await registerUserActivity(
          ACTION_TYPES.CREATE,
          `Creaste el nuevo documento ${documentData.title || 'sin título'}`
        );
        
        return response.data;
      } catch (error) {
        console.error("Error creating document:", error);
        throw error;
      }
    },

    /**
     * Update an existing document
     * @param {number|string} documentId - ID of the document to update
     * @param {Object} documentData - Updated document data
     * @returns {Object} The updated document
     */
    async updateDocument(documentId, documentData) {
      try {
        const response = await update_request(`dynamic-documents/${documentId}/update/`, documentData);
        
        // Update the cached document
        this.documentCache[documentId] = response.data;
        
        // Update in the main list if it exists there
        const existingIndex = this.documents.findIndex(doc => doc.id == documentId);
        if (existingIndex >= 0) {
          this.documents[existingIndex] = response.data;
        }
        
        // Track for highlighting
        this.lastUpdatedDocumentId = documentId;
        localStorage.setItem('lastUpdatedDocumentId', documentId);
        
        // Register user activity
        await registerUserActivity(
          ACTION_TYPES.UPDATE,
          `Actualizaste el documento ${documentData.title || 'sin título'}`
        );
        
        return response.data;
      } catch (error) {
        console.error(`Error updating document ID ${documentId}:`, error);
        throw error;
      }
    },

    /**
     * Delete a document by ID
     * @param {number|string} documentId - ID of the document to delete
     * @returns {boolean} Success status
     */
    async deleteDocument(documentId) {
      try {
        // Get document title before deletion for activity log
        let documentTitle = "document";
        const existingDoc = this.documentById(documentId);
        if (existingDoc) {
          documentTitle = existingDoc.title;
        }
        
        const response = await delete_request(`dynamic-documents/${documentId}/delete/`);
        
        if (response.status === 204) {
          // Remove from cache
          delete this.documentCache[documentId];
          
          // Remove from documents list
          this.documents = this.documents.filter(doc => doc.id != documentId);
          
          // Register user activity
          await registerUserActivity(
            ACTION_TYPES.DELETE,
            `Eliminaste el documento ${documentTitle}`
          );
          
          return true;
        }
        return false;
      } catch (error) {
        console.error(`Error deleting document ID ${documentId}:`, error);
        return false;
      }
    },

    /**
     * Download document as PDF
     * @param {number|string} documentId - ID of the document to download
     * @param {string} documentTitle - Title to use for the downloaded file
     */
    async downloadPDF(documentId, documentTitle) {
      try {
        await downloadFile(`dynamic-documents/${documentId}/download-pdf/`, `${documentTitle}.pdf`);
        
        // Register user activity
        await registerUserActivity(
          ACTION_TYPES.DOWNLOAD,
          `Descargaste en PDF "${documentTitle}"`
        );
      } catch (error) {
        console.error(`Error downloading PDF for document ID ${documentId}:`, error);
        throw error;
      }
    },

    /**
     * Download document as Word document
     * @param {number|string} documentId - ID of the document to download
     * @param {string} documentTitle - Title to use for the downloaded file
     */
    async downloadWord(documentId, documentTitle) {
      try {
        await downloadFile(`dynamic-documents/${documentId}/download-word/`, `${documentTitle}.docx`);
        
        // Register user activity
        await registerUserActivity(
          ACTION_TYPES.DOWNLOAD,
          `Descargaste en Word "${documentTitle}"`
        );
      } catch (error) {
        console.error(`Error downloading Word document for document ID ${documentId}:`, error);
        throw error;
      }
    },

    /**
     * Clear the selected document
     */
    clearSelectedDocument() {
      this.selectedDocument = null;
    },

    // =============================================
    // TAG MANAGEMENT ACTIONS
    // =============================================

    /**
     * Fetch all tags from the server
     * @param {boolean} forceRefresh - Whether to bypass cache
     * @returns {Promise<Array>} List of tags
     */
    async fetchTags(forceRefresh = false) {
      // Prevent multiple simultaneous requests
      if (this.isLoadingTags) return this.tags;
      
      // Return cached tags if available and not forcing refresh
      if (this.tagsLoaded && !forceRefresh) {
        return this.tags;
      }
      
      this.isLoadingTags = true;
      
      try {
        const response = await get_request('dynamic-documents/tags/');
        this.tags = response.data || [];
        this.tagsLoaded = true;
        
        return this.tags;
      } catch (error) {
        console.error("Error fetching tags:", error);
        this.tags = [];
        throw error;
      } finally {
        this.isLoadingTags = false;
      }
    },

    /**
     * Create a new tag
     * @param {Object} tagData - Tag data (name, color_id)
     * @returns {Promise<Object>} Created tag
     */
    async createTag(tagData) {
      try {
        const response = await create_request('dynamic-documents/tags/create/', tagData);
        
        // Add to local tags list
        this.tags.push(response.data);
        
        // Register user activity
        await registerUserActivity(
          ACTION_TYPES.CREATE,
          `Creaste la etiqueta "${tagData.name}"`
        );
        
        return response.data;
      } catch (error) {
        console.error("Error creating tag:", error);
        throw error;
      }
    },

    /**
     * Update an existing tag
     * @param {number|string} tagId - ID of the tag to update
     * @param {Object} tagData - Updated tag data
     * @returns {Promise<Object>} Updated tag
     */
    async updateTag(tagId, tagData) {
      try {
        const response = await update_request(`dynamic-documents/tags/${tagId}/update/`, tagData);
        
        // Update in local tags list
        const tagIndex = this.tags.findIndex(tag => tag.id == tagId);
        if (tagIndex >= 0) {
          this.tags[tagIndex] = response.data;
        }
        
        // Register user activity
        await registerUserActivity(
          ACTION_TYPES.UPDATE,
          `Actualizaste la etiqueta "${tagData.name || 'sin nombre'}"`
        );
        
        return response.data;
      } catch (error) {
        console.error(`Error updating tag ID ${tagId}:`, error);
        throw error;
      }
    },

    /**
     * Delete a tag
     * @param {number|string} tagId - ID of the tag to delete
     * @returns {Promise<boolean>} Success status
     */
    async deleteTag(tagId) {
      try {
        // Get tag name before deletion for activity log
        let tagName = "etiqueta";
        const existingTag = this.tagById(tagId);
        if (existingTag) {
          tagName = existingTag.name;
        }
        
        const response = await delete_request(`dynamic-documents/tags/${tagId}/delete/`);
        
        if (response.status === 204) {
          // Remove from local tags list
          this.tags = this.tags.filter(tag => tag.id != tagId);
          
          // Register user activity
          await registerUserActivity(
            ACTION_TYPES.DELETE,
            `Eliminaste la etiqueta "${tagName}"`
          );
          
          return true;
        }
        return false;
      } catch (error) {
        console.error(`Error deleting tag ID ${tagId}:`, error);
        return false;
      }
    },

    /**
     * Initialize tags data
     * @param {boolean} forceRefresh - Whether to force refresh
     */
    async initTags(forceRefresh = false) {
      if (!this.tagsLoaded || forceRefresh) {
        await this.fetchTags(forceRefresh);
      }
    },
  },
});
