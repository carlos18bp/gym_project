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
      if (this.dataLoaded) return;

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
     * Filter processes based on search query.
     * @param {object} state - State.
     * @returns {function} - Function to filter processes by search query.
     */
    filteredProcesses(searchQuery, displayParam) {
      let processesToFilter = this.processes;

      // Filter based on displayParam
      if (displayParam === "history") {
        processesToFilter = this.processesWithClosedStatus;
      } else {
        processesToFilter = this.processesWithoutClosedStatus;
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
     * Call creation process request.
     * @param {object} formData - Form data.
     */
    async createProcess(formData) {
      // Create a JSON object for the main form data
      const mainData = {
        plaintiff: formData.plaintiff,
        defendant: formData.defendant,
        caseTypeId: formData.caseTypeId,
        subcase: formData.subcase,
        ref: formData.ref,
        authority: formData.authority,
        clientId: formData.clientId,
        lawyerId: formData.lawyerId,
        stages: formData.stages, // Now directly an array of objects
      };

      // Create a FormData object for the request
      const formDataObject = new FormData();
      formDataObject.append("mainData", JSON.stringify(mainData)); // Add the main data as a string

      // Add case files separately to FormData
      formData.caseFiles.forEach((caseFile, index) => {
        if (caseFile.file) {
          formDataObject.append(`caseFiles[${index}]`, caseFile.file); // Just add the file without nesting
        }
      });

      try {
        let response = await create_request("create_process/", formDataObject);

        this.dataLoaded = false;
        await this.fetchProcessesData();

        return response.status;
      } catch (error) {
        console.error("Error creating process:", error.message);
        return null;
      }
    },

    /**
     * Call update process request.
     * @param {object} formData - Form data.
     */
    async updateProcess(formData) {
      // Create a JSON object for the main form data
      const mainData = {
        plaintiff: formData.plaintiff,
        defendant: formData.defendant,
        caseTypeId: formData.caseTypeId,
        subcase: formData.subcase,
        ref: formData.ref,
        authority: formData.authority,
        clientId: formData.clientId,
        lawyerId: formData.lawyerId,
        stages: formData.stages, // Directly an array of objects
        caseFileIds: formData.caseFiles
          .filter((caseFile) => caseFile.id) // Filter to include only case files with an id
          .map((caseFile) => caseFile.id), // Map filtered case files to an array of ids
      };

      // Create a FormData object for the request
      const formDataObject = new FormData();
      formDataObject.append("mainData", JSON.stringify(mainData)); // Add the main data as a string

      // Add the new case files without ID to FormData
      formData.caseFiles.forEach((caseFile, index) => {
        if (caseFile.file && !caseFile.id) {
          formDataObject.append(`caseFiles[${index}]`, caseFile.file); // Just add the file without nesting
        }
      });

      try {
        let response = await update_request(
          `update_process/${formData.processIdParam}/`,
          formDataObject
        );

        this.dataLoaded = false;
        await this.fetchProcessesData();

        return response.status;
      } catch (error) {
        console.error("Error creating process:", error.message);
        return null;
      }
    },
  },
});
