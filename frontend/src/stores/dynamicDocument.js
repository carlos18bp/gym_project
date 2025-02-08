import { defineStore } from "pinia";
import { get_request, create_request, update_request, delete_request } from "./services/request_http";

export const useDynamicDocumentStore = defineStore("dynamicDocument", {
  state: () => ({
    documents: [],            // List of dynamic documents
    selectedDocument: null,   // Currently selected document
    dataLoaded: false,        // Flag to indicate if documents have been fetched
  }),

  getters: {
    /**
     * Getter to find and return a document by its ID.
     */
    documentById: (state) => {
      return (documentId) => state.documents.find((doc) => doc.id == documentId) || null;
    },

    /**
     * Get documents assigned to a specific client by their user ID.
     */
    documentsByClient: (state) => (clientId) => {
      return state.documents.filter(doc => doc.assigned_to === clientId);
    },

    /**
     * Get documents with state 'Published' and no assigned client.
     */
    publishedDocumentsUnassigned: (state) => {
      return state.documents.filter(doc => doc.state === 'Published' && !doc.assigned_to);
    },

    /**
     * Get documents with state 'Draft' or 'Published' and no assigned client.
     */
    draftAndPublishedDocumentsUnassigned: (state) => {
      return state.documents.filter(doc => 
        (doc.state === 'Draft' || doc.state === 'Published') && !doc.assigned_to
      );
    },

    /**
     * Get documents with state 'Progress' and assigned to a client.
     */
    progressDocumentsByClient: (state) => (clientId) => {
      return state.documents.filter(doc => doc.state === 'Progress' && doc.assigned_to === clientId);
    },

    /**
     * Get documents with state 'Completed' and assigned to a client.
     */
    completedDocumentsByClient: (state) => (clientId) => {
      return state.documents.filter(doc => doc.state === 'Completed' && doc.assigned_to === clientId);
    },
  },

  actions: {
    /**
     * Fetch all dynamic documents from the backend if not already loaded.
     */
    async fetchDocuments() {
      if (!this.dataLoaded) {
        try {
          const response = await get_request("/dynamic-documents/");
          this.documents = response.data;
          this.dataLoaded = true;
          console.log("Documents fetched successfully:", this.documents);
        } catch (error) {
          console.error("Error fetching documents:", error);
        }
      }
    },

    /**
     * Create a new dynamic document by sending a POST request to the backend.
     * @param {Object} documentData - The data for the new document to be created.
     */
    async createDocument(documentData) {
      try {
        const response = await create_request("/dynamic-documents/create/", documentData);
        this.documents.push(response.data);
        this.selectedDocument = response.data;
        console.log("Document created successfully:", response.data);

        this.dataLoaded = false;
        await this.fetchDocuments();
      } catch (error) {
        console.error("Error creating document:", error);
      }
    },

    /**
     * Update an existing document by sending a PUT or PATCH request to the backend.
     * @param {number} documentId - The ID of the document to be updated.
     * @param {Object} documentData - The updated data for the document.
     */
    async updateDocument(documentId, documentData) {
      try {
        const response = await update_request(`/dynamic-documents/${documentId}/update/`, documentData);
        console.log("Document updated successfully:", response.data);

        this.dataLoaded = false;
        await this.fetchDocuments();
      } catch (error) {
        console.error("Error updating document:", error);
      }
    },

    /**
     * Delete a document by sending a DELETE request to the backend.
     * @param {number} documentId - The ID of the document to be deleted.
     */
    async deleteDocument(documentId) {
      try {
        await delete_request(`/dynamic-documents/${documentId}/delete/`);
        console.log(`Document with ID ${documentId} deleted successfully.`);
        
        this.dataLoaded = false;
        await this.fetchDocuments();
      } catch (error) {
        console.error("Error deleting document:", error);
      }
    },

    /**
     * Clear the currently selected document from the state.
     */
    clearSelectedDocument() {
      this.selectedDocument = null;
      console.log("Selected document cleared.");
    },
  },
});
