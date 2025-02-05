import { defineStore } from "pinia";
import { get_request, create_request, update_request, delete_request } from "./services/request_http";

export const useDynamicDocumentStore = defineStore("dynamicDocument", {
  state: () => ({
    documents: [], // Lista de documentos
    selectedDocument: null, // Documento actualmente seleccionado
    dataLoaded: false, // Bandera para evitar múltiples solicitudes de datos
  }),

  actions: {
    // Fetch all documents from the backend
    async fetchDocuments() {
      if (!this.dataLoaded) {
        try {
          const response = await get_request("dynamic-documents/");
          this.documents = response.data;
          this.dataLoaded = true;
          console.log("Documents fetched successfully:", this.documents);
        } catch (error) {
          console.error("Error fetching documents:", error);
        }
      }
    },

    // Create a new document
    async createDocument(documentData) {
      try {
        const response = await create_request("dynamic-documents/create/", documentData);
        this.documents.push(response.data); // Add the new document to the store
        console.log("Document created successfully:", response.data);
      } catch (error) {
        console.error("Error creating document:", error);
      }
    },

    // Update an existing document
    async updateDocument(documentId, documentData) {
      try {
        const response = await update_request(`dynamic-documents/${documentId}/update/`, documentData);
        const index = this.documents.findIndex((doc) => doc.id === documentId);
        if (index !== -1) this.documents[index] = response.data; // Update the document in the list
        if (this.selectedDocument?.id === documentId) {
          this.selectedDocument = response.data; // Update the selected document if applicable
        }
        console.log("Document updated successfully:", response.data);
      } catch (error) {
        console.error("Error updating document:", error);
      }
    },

    // Delete a document
    async deleteDocument(documentId) {
      try {
        await delete_request(`dynamic-documents/${documentId}/delete/`);
        this.documents = this.documents.filter((doc) => doc.id !== documentId); // Remove the document from the list
        if (this.selectedDocument?.id === documentId) this.selectedDocument = null; // Reset selected document if deleted
        console.log(`Document with ID ${documentId} deleted successfully.`);
      } catch (error) {
        console.error("Error deleting document:", error);
      }
    },

    // Select a document for editing or viewing
    selectDocument(documentId) {
      this.selectedDocument = this.documents.find((doc) => doc.id === documentId) || null;
      console.log("Document selected:", this.selectedDocument);
    },

    // Clear the selected document
    clearSelectedDocument() {
      this.selectedDocument = null;
      console.log("Selected document cleared.");
    },
  },
});
