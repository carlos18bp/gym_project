import { defineStore } from "pinia";
import { get_request, create_request, update_request, delete_request } from "./services/request_http";

export const useDynamicDocumentStore = defineStore("dynamicDocument", {
  state: () => ({
    documents: [],
    selectedDocument: null, // Documento actualmente seleccionado
    dataLoaded: false,
  }),

  actions: {
    async fetchDocuments() {
      if (!this.dataLoaded) {
        try {
          const response = await get_request("dynamic-documents/");
          this.documents = response.data;
          this.dataLoaded = true;
        } catch (error) {
          console.error("Error fetching documents:", error);
        }
      }
    },

    async createDocument(documentData) {
      try {
        const response = await create_request("dynamic-documents/create/", documentData);
        this.documents.push(response.data);
      } catch (error) {
        console.error("Error creating document:", error);
      }
    },

    async updateDocument(documentId, documentData) {
      try {
        const response = await update_request(`dynamic-documents/${documentId}/update/`, documentData);
        const index = this.documents.findIndex((doc) => doc.id === documentId);
        if (index !== -1) this.documents[index] = response.data;
      } catch (error) {
        console.error("Error updating document:", error);
      }
    },

    async deleteDocument(documentId) {
      try {
        await delete_request(`dynamic-documents/${documentId}/delete/`);
        this.documents = this.documents.filter((doc) => doc.id !== documentId);
        if (this.selectedDocument?.id === documentId) this.selectedDocument = null;
        console.log(`Document with ID ${documentId} deleted successfully.`);
      } catch (error) {
        console.error("Error deleting document:", error);
      }
    },

    async updateDocument(documentId, documentData) {
      try {
        const response = await update_request(`dynamic-documents/${documentId}/update/`, documentData);
        const index = this.documents.findIndex((doc) => doc.id === documentId);
        if (index !== -1) this.documents[index] = response.data;
        this.selectedDocument = response.data; // Update the selected document
      } catch (error) {
        console.error("Error updating document:", error);
      }
    },    
  },
});
