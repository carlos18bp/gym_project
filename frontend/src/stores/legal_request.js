import { defineStore } from "pinia";
import { create_request } from "./services/request_http";

export const useLegalRequestStore = defineStore("legalRequest", {
  /**
   * Store state.
   * @returns {object} State object.
   */
  state: () => ({
    legalRequests: [],
    dataLoaded: false,
  }),

  actions: {
    /**
     * Initialize the store by fetching data if not already loaded.
     */
    async init() {
      if (!this.dataLoaded) {
        // Implement fetching data logic if necessary
      }
    },

    /**
     * Create a new legal request and upload associated files.
     *
     * @param {object} formData - The form data containing request details and files.
     * @returns {number|null} - HTTP status code (201 for success) or null in case of error.
     */
    async createLegalRequest(formData) {
      const mainData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        requestTypeId: formData.requestTypeId,
        disciplineId: formData.disciplineId,
        description: formData.description,
      };

      const formDataObject = new FormData();
      formDataObject.append("mainData", JSON.stringify(mainData)); // Attach main request data as JSON

      // Attach files (if any) to the FormData
      if (formData.files) {
        formData.files.forEach((file) => {
          formDataObject.append("files", file);
        });
      }

      try {
        // Send the request to the backend
        const response = await create_request("create_legal_request/", formDataObject);

        if (response.status === 201) {
          this.dataLoaded = false; // Reset dataLoaded to force refresh if necessary
          return response.status; // Return success status code
        } else {
          console.error("Failed to create legal request:", response.status);
          return null;
        }
      } catch (error) {
        console.error("Error creating legal request:", error.message);
        return null;
      }
    },
  },
});
