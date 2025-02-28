import { defineStore } from "pinia";
import {
  get_request,
  create_request,
  update_request,
  delete_request,
} from "./services/request_http";
import { downloadFile } from "@/shared/document_utils";

export const useDynamicDocumentStore = defineStore("dynamicDocument", {
  state: () => ({
    documents: [], // List of dynamic documents
    selectedDocument: null, // Currently selected document
    dataLoaded: false, // Flag to indicate if documents have been fetched
  }),

  getters: {
    /**
     * Getter to find and return a document by its ID.
     */
    documentById: (state) => {
      return (documentId) =>
        state.documents.find((doc) => doc.id == documentId) || null;
    },

    /**
     * Get documents with state 'Published' and no assigned client.
     */
    publishedDocumentsUnassigned: (state) => {
      return state.documents.filter(
        (doc) => doc.state === "Published" && !doc.assigned_to
      );
    },

    /**
     * Get documents with state 'Draft' or 'Published' and no assigned client.
     */
    draftAndPublishedDocumentsUnassigned: (state) => {
      return state.documents.filter(
        (doc) =>
          (doc.state === "Draft" || doc.state === "Published") &&
          !doc.assigned_to
      );
    },

    /**
     * Get documents with state 'Progress' and assigned to a client.
     */
    progressDocumentsByClient: (state) => {
      return state.documents.filter(
        (doc) => doc.state === "Progress"
      );
    },

    /**
     * Get documents with state 'Completed' and assigned to a client.
     */
    completedDocumentsByClient: (state) => {
      return state.documents.filter(
        (doc) => doc.state === "Completed"
      );
    },

    /**
     * Get filtered documents assigned to a specific client.
     * @param {object} state - Store state.
     * @returns {function} - Function that takes a client ID and returns filtered documents.
     */
    progressAndCompletedDocumentsByClient: (state) => (clientId) => {
      return state.documents.filter(
        (doc) =>
          doc.assigned_to === clientId &&
          (doc.state === "Progress" || doc.state === "Completed")
      );
    },

    /**
     * Get filtered documents based on a search query.
     * @param {object} state - The store state.
     * @returns {function} - Function that takes a search query and filters documents.
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
                .includes(lowerQuery))) // Search by assigned client
          /**
           * TODO: Should it be included ?
          (doc.variables &&
            doc.variables.some(
              (variable) =>
                variable.name_en.toLowerCase().includes(lowerQuery) ||
                variable.name_es.toLowerCase().includes(lowerQuery) ||
                variable.value?.toLowerCase().includes(lowerQuery)
            )
          */
        );
      });
    },
  },

  actions: {
    /**
     * Initialize the store by fetching data if not already loaded.
     */
    async init() {
      if (!this.dataLoaded) await this.fetchDocuments();
    },

    /**
     * Fetch all dynamic documents from the backend if not already loaded.
     */
    async fetchDocuments() {
      try {
        const response = await get_request("dynamic-documents/");
        this.documents = response.data;
        this.dataLoaded = true;
      } catch (error) {
        console.error("Error fetching documents:", error);
      }
    },

    /**
     * Create a new dynamic document by sending a POST request to the backend.
     * @param {Object} documentData - The data for the new document to be created.
     */
    async createDocument(documentData) {
      try {
        const response = await create_request(
          "dynamic-documents/create/",
          documentData
        );
        this.documents.push(response.data);
        this.selectedDocument = response.data;

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
        const response = await update_request(
          `dynamic-documents/${documentId}/update/`,
          documentData
        );

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
        await delete_request(`dynamic-documents/${documentId}/delete/`);

        this.dataLoaded = false;
        await this.fetchDocuments();
      } catch (error) {
        console.error("Error deleting document:", error);
      }
    },

    /**
     * Request the backend to generate and download a PDF version of the document.
     * @param {number} documentId - The ID of the document.
     * @param {string} documentTitle - The title of the document for naming the file.
     */
    async downloadPDF(documentId, documentTitle) {
      await downloadFile(
        `dynamic-documents/${documentId}/download-pdf/`,
        `${documentTitle}.pdf`
      );
    },

    /**
     * Request the backend to generate and download a Word (.docx) version of the document.
     * @param {number} documentId - The ID of the document.
     * @param {string} documentTitle - The title of the document for naming the file.
     */
    async downloadWord(documentId, documentTitle) {
      await downloadFile(
        `dynamic-documents/${documentId}/download-word/`,
        `${documentTitle}.docx`,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
    },

    /**
     * Clear the currently selected document from the state.
     */
    clearSelectedDocument() {
      this.selectedDocument = null;
    },
  },
});
