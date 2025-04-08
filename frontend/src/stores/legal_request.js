import { defineStore } from "pinia";
import { get_request, create_request } from "./services/request_http";
import { registerUserActivity, ACTION_TYPES } from "./activity_feed";

export const useLegalRequestStore = defineStore("legalRequest", {
  /**
   * Store state.
   * @returns {object} State object.
   */
  state: () => ({
    legalRequests: [],
    dataLoaded: false,
    legalRequestTypes: [],
    legalDisciplines: [],
  }),

  actions: {
    /**
     * Initialize the store by fetching data if not already loaded.
     */
    async init() {
      if (!this.dataLoaded) await this.fetchDropDownOptionsData();
    },

    /**
     * Fetch Dropdown options data from backend.
     */
    async fetchDropDownOptionsData() {
      try {
        // Makes the request to endpoint
        let response = await get_request("dropdown_options_legal_request/");
        let jsonData = response.data;

        // Verify if the response is available
        if (jsonData && typeof jsonData === "string") {
          try {
            jsonData = JSON.parse(jsonData);
          } catch (error) {
            console.error("JSON parse error:", error.message);
            jsonData = { legal_request_types: [], legal_disciplines: [] }; // Default value
          }
        }

        // Assing the data to the variables
        this.legalRequestTypes = jsonData.legal_request_types ?? [];
        this.legalDisciplines = jsonData.legal_disciplines ?? [];
        this.dataLoaded = true; // Mark when the data is charged
      } catch (error) {
        console.error("Error fetching dropdown options data:", error.message);
        // If there's a error in the request, assign default value
        this.legalRequestTypes = [];
        this.legalDisciplines = [];
        this.dataLoaded = false;
      }
    },

    /**
     * Create a new legal request (only text data) and upload associated files separately.
     *
     * @param {object} formData - The form data containing request details.
     * @returns {number|null} - HTTP status code (201 for success) or null in case of error.
     */
    async createLegalRequest(formData) {
      const mainData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        requestTypeId: formData.requestTypeId.id,
        disciplineId: formData.disciplineId.id,
        description: formData.description,
      };

      const formDataObject = new FormData();
      formDataObject.append("mainData", JSON.stringify(mainData)); // Attach main request data as JSON
      try {
        // Step 1: Send main text data to the backend
        const response = await create_request(
          "create_legal_request/",
          formDataObject
        );

        if (response.status === 201) {
          const legalRequestId = response.data.id; // Retrieve the created legal request ID

          // Step 2: Upload associated files (if any)
          if (formData.files && formData.files.length > 0) {
            const uploadResults = await this.uploadFiles(
              legalRequestId,
              formData.files
            );
            // Check if all files were uploaded successfully
            const allUploaded = uploadResults.every((result) => result.success);
            if (!allUploaded) {
              console.warn(
                "Some files failed to upload:",
                uploadResults.filter((r) => !r.success)
              );
            }
          }

          // Get the request type name for the activity description
          const requestTypeName = formData.requestTypeId.name || "legal";
          const disciplineName = formData.disciplineId.name || "";
          
          // Register activity for legal request creation
          await registerUserActivity(
            ACTION_TYPES.CREATE,
            `Radicaste una solicitud de ${requestTypeName}${disciplineName ? ` en ${disciplineName}` : ''}.`
          );

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

    /**
     * Upload files one by one to associate with a specific legal request.
     *
     * @param {number} legalRequestId - The ID of the legal request.
     * @param {Array} files - List of files to upload.
     * @returns {Array} - List of upload results (success or failure for each file).
     */
    async uploadFiles(legalRequestId, files) {
      const results = [];
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append("file", file); // Attach the file
          formData.append("legalRequestId", legalRequestId); // Associate with the legal request

          const response = await create_request(
            "upload_legal_request_file/",
            formData
          );

          results.push({
            file: file.name,
            success: response.status === 201, // Check if the upload was successful
          });
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error.message);
          results.push({
            file: file.name,
            success: false,
          });
        }
      }

      return results; // Return a list of upload results
    },
  },
});
