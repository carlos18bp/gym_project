import { defineStore } from "pinia";
import { get_request, create_request } from "../services/request_http";
import { registerUserActivity, ACTION_TYPES } from "../dashboard/activity_feed";

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
    lastCreatedRequestId: null, // Store the last created request ID for file processing
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
          
          // Store the created request ID for later file processing
          this.lastCreatedRequestId = legalRequestId;
          
          // Get the request type name for the activity description
          const requestTypeName = formData.requestTypeId.name || "legal";
          const disciplineName = formData.disciplineId.name || "";
          
          // Register activity for legal request creation (non-blocking)
          registerUserActivity(
            ACTION_TYPES.CREATE,
            `Radicaste una solicitud de ${requestTypeName}${disciplineName ? ` en ${disciplineName}` : ''}.`
          ).catch(error => {
            console.warn("Activity registration failed:", error);
          });

          // Send confirmation email asynchronously (non-blocking)
          setTimeout(() => {
            this.sendConfirmationEmailAsync(legalRequestId);
          }, 200);

          // Step 2: Upload associated files asynchronously (in background, non-blocking)
          if (formData.files && formData.files.length > 0) {
            // Start file upload process in background without blocking the response
            setTimeout(() => {
              this.uploadFilesAsync(legalRequestId, formData.files);
            }, 300); // Small delay to ensure UI updates first
          }

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

    /**
     * Upload files asynchronously using the new backend endpoint that supports multiple files.
     * This function provides retry logic with exponential backoff and immediate user feedback.
     *
     * @param {number} legalRequestId - The ID of the legal request.
     * @param {Array} files - List of files to upload.
     */
    async uploadFilesAsync(legalRequestId, files) {
      const maxRetries = 3;
      const baseDelay = 1000; // 1 second
      
      const uploadWithRetry = async (formData, retryCount = 0) => {
        try {
          const response = await create_request(
            "upload_legal_request_file/",
            formData
          );
          
          return response;
        } catch (error) {
          if (retryCount < maxRetries) {
            // Exponential backoff with jitter
            const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000;
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return uploadWithRetry(formData, retryCount + 1);
          }
          
          throw error;
        }
      };
      
      try {
        // Create FormData with all files
        const formData = new FormData();
        formData.append("legalRequestId", legalRequestId);
        
        // Append all files at once for parallel backend processing
        files.forEach((file, index) => {
          formData.append(`files`, file); // Using 'files' key for multiple files
        });
        
        // Upload all files with retry logic
        const response = await uploadWithRetry(formData);
        
        if (response.status === 201) {
        } else {
          console.warn('Some files may have failed to upload:', response.data);
        }
        
      } catch (error) {
        console.error("Error uploading files after all retries:", error.message);
        // Files upload failure is already handled by backend via email notification
      }
    },

    /**
     * Get the ID of the last created legal request.
     * This is a simple helper method for background file processing.
     * @returns {number|null} The ID of the last created request or null if none found
     */
    getLastCreatedRequestId() {
      return this.lastCreatedRequestId;
    },

    /**
     * Send confirmation email asynchronously for a legal request.
     * @param {number} legalRequestId - The ID of the legal request
     */
    async sendConfirmationEmailAsync(legalRequestId) {
      try {
        const formData = new FormData();
        formData.append("legal_request_id", legalRequestId);
        
        const response = await create_request(
          "send_confirmation_email/",
          formData
        );
        
        if (response.status === 200) {
        } else {
          console.warn(`Failed to send confirmation email for legal request ${legalRequestId}`);
        }
      } catch (error) {
        console.error(`Error sending confirmation email for legal request ${legalRequestId}:`, error);
      }
    },
  },
});
