import { defineStore } from "pinia";
import { get_request, create_request } from "./services/request_http";

export const useIntranetGymStore = defineStore("intranetGymStore", {
  /**
   * Store state.
   */
  state: () => ({
    legalLinks: [], // Array to store legal links
    dataLoaded: false, // Flag to check if data has been loaded
  }),

  /**
   * Store actions.
   */
  actions: {
    /**
     * Initialize the store by fetching data if not already loaded.
     */
    async init() {
      if (!this.dataLoaded) await this.fetchLegalLinks();
    },

    /**
     * Fetch legal links from the backend.
     */
    async fetchLegalLinks() {
      try {
        const response = await get_request(`legal_intranet_links/`);
        this.legalLinks = response.data;
        this.dataLoaded = true;
      } catch (error) {
        console.error("Error fetching legal links:", error);
        this.legalLinks = [];
        this.dataLoaded = false;
      }
    },

    /**
     * Create a new report request with all data and files sent together.
     *
     * @param {object} formData - The form data containing report details.
     * @returns {number|null} - HTTP status code (201 for success) or null in case of error.
     */
    async createReportRequest(formData) {
      const formDataObject = new FormData();

      // Append main text fields
      formDataObject.append("document", formData.document); // Document number
      formDataObject.append("initialDate", formData.initialDate); // Start date
      formDataObject.append("endDate", formData.endDate); // End date
      formDataObject.append("paymentConcept", formData.paymentConcept); // Payment concept
      formDataObject.append("paymentAmount", formData.paymentAmount); // Payment amount

      // Append files
      if (formData.files && formData.files.length > 0) {
        formData.files.forEach((file, index) => {
          formDataObject.append(`files[${index}]`, file); // Attach each file with a unique key
        });
      }

      try {
        // Send the form data to the backend
        const response = await create_request(
          "create_report_request/",
          formDataObject
        );

        if (response.status === 201) {
          this.dataLoaded = false; // Reset dataLoaded to force refresh if necessary
          return response.status; // Return success status code
        } else {
          console.error("Failed to create report request:", response.status);
          return null;
        }
      } catch (error) {
        console.error("Error creating report request:", error.message);
        return null;
      }
    },
  },
});
