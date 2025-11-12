import {
  get_request,
  create_request,
  update_request,
  delete_request,
  upload_file_request,
} from "../services/request_http";
import axios from "axios";
import { downloadFile } from "@/shared/document_utils";
import { registerUserActivity, ACTION_TYPES } from "../dashboard/activity_feed";

/**
 * Document management actions
 */
export const documentActions = {
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
      // Ensure state and assigned_to are correct (safety check for client documents)
      if (documentData.state !== 'Progress' && documentData.state !== 'Draft' && documentData.assigned_to) {
        // If document has assigned_to (client document), force Progress state
        documentData.state = 'Progress';
      }
      
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

  /**
   * Upload letterhead image for a dynamic document
   * 
   * @param {number|string} documentId - ID of the document
   * @param {File} imageFile - PNG image file to upload
   * @returns {Promise<Object>} - Upload response with image info
   */
  async uploadLetterheadImage(documentId, imageFile) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await upload_file_request(
        `dynamic-documents/${documentId}/letterhead/upload/`,
        formData
      );
      
      // Register user activity
      await registerUserActivity(
        ACTION_TYPES.UPDATE,
        `Subiste imagen de membrete para documento ID ${documentId}`
      );
      
      return response;
    } catch (error) {
      console.error(`Error uploading letterhead image for document ID ${documentId}:`, error);
      throw error;
    }
  },

  /**
   * Get letterhead image for a dynamic document
   * 
   * @param {number|string} documentId - ID of the document
   * @param {string} responseType - Response type (default: 'blob' for images)
   * @returns {Promise<Object>} - Image response
   */
  async getLetterheadImage(documentId, responseType = 'blob') {
    // Use axios directly to handle 404 silently without logging from request_http.js
    const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];
    const token = localStorage.getItem('token');
    
    const headers = {
      'X-CSRFToken': csrfToken,
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    try {
      const response = await axios.get(
        `/api/dynamic-documents/${documentId}/letterhead/`,
        { 
          headers, 
          responseType,
          // Don't treat 404 as an error - it's expected when document has no letterhead
          validateStatus: (status) => status === 200 || status === 404
        }
      );
      
      // If 404, return null to indicate no letterhead exists
      if (response.status === 404) {
        return null;
      }
      
      return response;
    } catch (error) {
      // This should only catch non-404 errors now
      console.error(`Error fetching letterhead image for document ID ${documentId}:`, error);
      throw error;
    }
  },

  /**
   * Delete letterhead image for a dynamic document
   * 
   * @param {number|string} documentId - ID of the document
   * @returns {Promise<Object>} - Delete response
   */
  async deleteLetterheadImage(documentId) {
    try {
      const response = await delete_request(
        `dynamic-documents/${documentId}/letterhead/delete/`
      );
      
      // Register user activity
      await registerUserActivity(
        ACTION_TYPES.DELETE,
        `Eliminaste imagen de membrete para documento ID ${documentId}`
      );
      
      return response;
    } catch (error) {
      console.error(`Error deleting letterhead image for document ID ${documentId}:`, error);
      throw error;
    }
  },

  /**
   * Upload global letterhead image for the authenticated user
   * 
   * @param {File} imageFile - PNG image file to upload
   * @returns {Promise<Object>} - Upload response with image info
   */
  async uploadGlobalLetterheadImage(imageFile) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await upload_file_request(
        `user/letterhead/upload/`,
        formData
      );
      
      // Register user activity
      await registerUserActivity(
        ACTION_TYPES.UPDATE,
        `Subiste imagen de membrete global`
      );
      
      return response;
    } catch (error) {
      console.error(`Error uploading global letterhead image:`, error);
      throw error;
    }
  },

  /**
   * Get global letterhead image for the authenticated user
   * 
   * @param {string} responseType - Response type (default: 'blob' for images)
   * @returns {Promise<Object>} - Image response
   */
  async getGlobalLetterheadImage(responseType = 'blob') {
    try {
      const response = await get_request(
        `user/letterhead/`,
        responseType
      );
      
      return response;
    } catch (error) {
      console.error(`Error fetching global letterhead image:`, error);
      throw error;
    }
  },

  /**
   * Delete global letterhead image for the authenticated user
   * 
   * @returns {Promise<Object>} - Delete response
   */
  async deleteGlobalLetterheadImage() {
    try {
      const response = await delete_request(
        `user/letterhead/delete/`
      );
      
      // Register user activity
      await registerUserActivity(
        ACTION_TYPES.DELETE,
        `Eliminaste imagen de membrete global`
      );
      
      return response;
    } catch (error) {
      console.error(`Error deleting global letterhead image:`, error);
      throw error;
    }
  },
};