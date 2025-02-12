import { defineStore } from "pinia";
import {
  get_request,
  create_request,
  update_request,
} from "./services/request_http";

export const useProcessStore = defineStore("process", {
  /**
   * Store state.
   * @returns {object} State object.
   */
  state: () => ({
    processes: [],
    dataLoaded: false,
  }),

  getters: {
    /**
     * Get process by ID.
     * @param {object} state - State.
     * @returns {function} - Function to find process by ID.
     */
    processById: (state) => (processId) => {
      return state.processes.find((process) => process.id == processId);
    },

    /**
     * Get processes where the last status is "Fallo".
     * @param {object} state - State.
     * @returns {array} - List of processes with last status as "Fallo".
     */
    processesWithClosedStatus: (state) => {
      return state.processes.filter((process) => {
        const lastStage = process.stages[process.stages.length - 1];
        return lastStage && lastStage.status === "Fallo";
      });
    },

    /**
     * Get processes where the last status is not "Fallo".
     * @param {object} state - State.
     * @returns {array} - List of processes with last status different from "Fallo".
     */
    processesWithoutClosedStatus: (state) => {
      return state.processes.filter((process) => {
        const lastStage = process.stages[process.stages.length - 1];
        return lastStage && lastStage.status !== "Fallo";
      });
    },
  },

  actions: {
    /**
     * Initialize store by fetching data if not already loaded.
     */
    async init() {
      if (!this.dataLoaded) await this.fetchProcessesData();
    },

    /**
     * Fetch processes data from backend.
     */
    async fetchProcessesData() {
      try {
        let response = await get_request("processes/");
        let jsonData = response.data;

        if (jsonData && typeof jsonData === "string") {
          try {
            jsonData = JSON.parse(jsonData);
          } catch (error) {
            console.error("JSON parse error:", error.message);
            jsonData = [];
          }
        }

        this.processes = jsonData ?? [];
        this.dataLoaded = true;
      } catch (error) {
        console.error("Error fetching processes data:", error.message);
        this.processes = [];
        this.dataLoaded = false;
      }
    },

    /**
     * Filter processes based on search query, user role, and display parameters.
     *
     * This function filters the list of processes based on several criteria:
     * 1. `displayParam`: Determines if the processes should be filtered based on the status ("history" for closed cases, otherwise for open cases).
     * 2. `userIdParam`: If provided, filters the processes based on the user's role.
     *    - If the user is a client, it returns only the processes associated with that client.
     *    - If the user is a lawyer, it returns only the processes associated with that lawyer.
     * 3. `searchQuery`: Filters the processes based on a search string applied to multiple fields, including:
     *    - Top-level fields: `plaintiff`, `defendant`, `authority`, `ref`, `subcase`.
     *    - Case type: Searches within the `case.type` field.
     *    - Stages: Searches within each `status` in the `stages` array.
     *
     * @param {string} searchQuery - The search string used to filter the processes.
     * @param {number} userIdParam - The user ID used to filter processes based on the user's role (client or lawyer).
     * @param {string} displayParam - A parameter to determine if processes should be filtered by status ("history" for closed cases, other values for open cases).
     * @returns {Array} - A list of filtered processes matching the search criteria.
     */

    filteredProcesses(searchQuery, isClient, userIdParam, displayParam) {
      let processesToFilter = this.processes;

      // Filter based on displayParam
      if (displayParam == "history") {
        processesToFilter = this.processesWithClosedStatus;
      } else {
        processesToFilter = this.processesWithoutClosedStatus;
      }

      if (userIdParam) {
        // Check the role of the user and filter accordingly
        if (isClient) {
          processesToFilter = processesToFilter.filter(
            (process) => process.client.id == userIdParam
          );
        } else {
          processesToFilter = processesToFilter.filter(
            (process) => process.lawyer.id == userIdParam
          );
        }
      }

      if (!searchQuery) return processesToFilter;

      const lowerCaseQuery = searchQuery.toLowerCase();

      // Apply the robust filter logic
      return processesToFilter.filter((process) => {
        // Check for match in top-level fields
        const topLevelMatch = [
          "plaintiff",
          "defendant",
          "authority",
          "ref",
          "subcase",
        ].some((field) =>
          process[field]?.toLowerCase().includes(lowerCaseQuery)
        );

        // Check for match in case type
        const caseTypeMatch = process.case.type
          .toLowerCase()
          .includes(lowerCaseQuery);

        // Check for match in stages array (status field)
        const stagesMatch = process.stages.some((stage) =>
          stage.status.toLowerCase().includes(lowerCaseQuery)
        );

        // Return true if any of the matches are found
        return topLevelMatch || caseTypeMatch || stagesMatch;
      });
    },

    /**
     * Create a new process and optionally upload associated files.
     *
     * This function sends the main process data to the backend to create a new process.
     * After successfully creating the process, it uploads any associated files one by one.
     *
     * @param {object} formData - The form data containing process details and files.
     * @returns {number|null} - HTTP status code (201 for success) or null in case of error.
     */
    async createProcess(formData) {
      const mainData = {
        plaintiff: formData.plaintiff,
        defendant: formData.defendant,
        caseTypeId: formData.caseTypeId,
        subcase: formData.subcase,
        ref: formData.ref,
        authority: formData.authority,
        clientId: formData.clientId,
        lawyerId: formData.lawyerId,
        stages: formData.stages,
      };

      const formDataObject = new FormData();
      formDataObject.append("mainData", JSON.stringify(mainData)); // Attach main process data as JSON

      try {
        // Step 1: Send main process data to the backend
        const response = await create_request(
          "create_process/",
          formDataObject
        );

        if (response.status === 201) {
          const processId = response.data.id; // Retrieve the created process ID

          // Step 2: Upload associated files (if any)
          if (formData.caseFiles.length > 0) {
            const uploadResults = await this.uploadFiles(
              processId,
              formData.caseFiles
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

          this.dataLoaded = false;
          await this.fetchProcessesData();

          return response.status; // Return success status code
        } else {
          console.error("Failed to create process:", response.status);
          return null;
        }
      } catch (error) {
        console.error("Error creating process:", error.message);
        return null;
      }
    },

    /**
     * Update an existing process and optionally upload new files.
     *
     * This function updates the main process data on the backend and uploads any new files
     * associated with the process that do not already exist in the system.
     *
     * @param {object} formData - The form data containing process details and files.
     * @returns {number|null} - HTTP status code (200 for success) or null in case of error.
     */
    async updateProcess(formData) {
      const mainData = {
        plaintiff: formData.plaintiff,
        defendant: formData.defendant,
        caseTypeId: formData.caseTypeId,
        subcase: formData.subcase,
        ref: formData.ref,
        authority: formData.authority,
        clientId: formData.clientId,
        lawyerId: formData.lawyerId,
        stages: formData.stages,
        caseFileIds: formData.caseFiles
          .filter((caseFile) => caseFile.id) // Include only existing files by ID
          .map((caseFile) => caseFile.id), // Map to an array of IDs
      };

      const formDataObject = new FormData();
      formDataObject.append("mainData", JSON.stringify(mainData)); // Attach main process data as JSON

      try {
        // Step 1: Send updated process data to the backend
        const response = await update_request(
          `update_process/${formData.processIdParam}/`,
          formDataObject
        );

        if (response.status === 200) {
          // Step 2: Upload new files (files without an existing ID)
          const newFiles = formData.caseFiles.filter(
            (file) => file.file && !file.id
          );
          if (newFiles.length > 0) {
            const uploadResults = await this.uploadFiles(
              formData.processIdParam,
              newFiles
            );

            // Check upload results
            const allUploaded = uploadResults.every((result) => result.success);
            if (!allUploaded) {
              console.warn(
                "Some files failed to upload:",
                uploadResults.filter((r) => !r.success)
              );
            }
          }

          this.dataLoaded = false;
          await this.fetchProcessesData();

          return response.status; // Return success status code
        } else {
          console.error("Failed to update process:", response.status);
          return null;
        }
      } catch (error) {
        console.error("Error updating process:", error.message);
        return null;
      }
    },

    /**
     * Upload multiple files for a specific process.
     *
     * This function iterates over a list of files and uploads each file individually
     * to the backend, associating it with the given process ID.
     *
     * @param {number} processId - The ID of the process to associate the files with.
     * @param {Array} files - List of files to be uploaded.
     * @returns {Array} - List of results for each file, containing the file name and success status.
     */
    async uploadFiles(processId, files) {
      const results = [];

      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append("file", file.file); // Attach the file
          formData.append("processId", processId); // Associate with the process

          const response = await create_request("update_case_file/", formData);

          results.push({
            file: file.file.name,
            success: response.status === 201, // Check if the upload was successful
          });
        } catch (error) {
          console.error(
            `Error uploading file ${file.file.name}:`,
            error.message
          );
          results.push({
            file: file.file.name,
            success: false,
          });
        }
      }

      return results; // Return a list of upload results
    },
  },
});
