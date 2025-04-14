import { defineStore } from "pinia";
import {
  get_request,
  create_request,
  update_request,
} from "./services/request_http";
import { useUserStore } from "./user";
import { registerUserActivity, ACTION_TYPES } from "./activity_feed";

export const useProcessStore = defineStore("process", {
  /**
   * Store state.
   * @returns {object} State object.
   */
  state: () => ({
    processes: [],
    dataLoaded: false,
    pagination: {
      currentPage: 1,
      totalItems: 0,
      totalPages: 0,
      itemsPerPage: 20,
      hasMore: false
    },
    isFetching: false,
    lastFetchTime: null
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

    /**
     * Get active processes for the current user.
     * @param {object} state - State.
     * @returns {array} - List of active processes for the current user.
     */
    activeProcessesForCurrentUser: (state) => {
      const userStore = useUserStore();
      const currentUser = userStore.getCurrentUser;
      
      if (!currentUser) return [];

      return state.processes.filter((process) => {
        const lastStage = process.stages[process.stages.length - 1];
        const isActive = lastStage && lastStage.status !== "Fallo";
        
        if (currentUser.role === "client") {
          return isActive && process.client.id === currentUser.id;
        } else if (currentUser.role === "lawyer") {
          return isActive && process.lawyer.id === currentUser.id;
        }
        
        return false;
      });
    },
  },

  actions: {
    /**
     * Initialize store by fetching data if not already loaded or if data is stale.
     */
    async init() {
      // Only load data if not loaded or if it's stale (older than 5 minutes)
      const shouldFetch = !this.dataLoaded || 
                          !this.lastFetchTime || 
                          (Date.now() - this.lastFetchTime > 5 * 60 * 1000);
      
      if (shouldFetch) {
        await this.fetchProcessesData();
      }
    },

    /**
     * Fetch processes data from backend with pagination support.
     * 
     * @param {Object} options - Options for fetching data
     * @param {number} options.page - Page number to fetch (default: 1)
     * @param {number} options.limit - Number of items per page (default: from state)
     * @param {string} options.filter - Optional filter string 
     * @param {boolean} options.append - Whether to append results to existing data (default: false)
     * @param {boolean} options.forceRefresh - Whether to force refresh even if data was recently loaded
     * @returns {Promise<Object>} Pagination data including totalItems, totalPages, etc.
     */
    async fetchProcessesData(options = {}) {
      const { 
        page = 1, 
        limit = this.pagination.itemsPerPage, 
        filter = '',
        append = false,
        forceRefresh = false
      } = options;
      
      // Prevent multiple simultaneous fetches
      if (this.isFetching) return;
      
      // Skip if data was loaded recently (within last 30 seconds) unless forced
      const recentlyLoaded = this.lastFetchTime && (Date.now() - this.lastFetchTime < 30 * 1000);
      if (recentlyLoaded && !forceRefresh && this.dataLoaded) return;
      
      this.isFetching = true;
      
      try {
        // Build query parameters for the request
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('limit', limit);
        if (filter) params.append('filter', filter);
        
        const endpoint = `processes/?${params.toString()}`;
        let response = await get_request(endpoint);
        let jsonData = response.data;

        // Ensure jsonData is an object with items array
        if (jsonData && typeof jsonData === "string") {
          try {
            jsonData = JSON.parse(jsonData);
          } catch (error) {
            console.error("JSON parse error:", error.message);
            jsonData = { items: [], totalItems: 0, totalPages: 0 };
          }
        }
        
        // Handle backend not returning in expected format
        if (!jsonData.items && Array.isArray(jsonData)) {
          jsonData = { 
            items: jsonData, 
            totalItems: jsonData.length, 
            totalPages: 1,
            currentPage: 1
          };
        }
        
        // Update pagination state
        this.pagination = {
          currentPage: page,
          totalItems: jsonData.totalItems || jsonData.items.length,
          totalPages: jsonData.totalPages || 1,
          itemsPerPage: limit,
          hasMore: (jsonData.totalPages && page < jsonData.totalPages) || false
        };

        // Update processes data
        if (append && page > 1) {
          // Append new items to existing array
          this.processes = [...this.processes, ...jsonData.items];
        } else {
          // Replace with new data
          this.processes = jsonData.items || [];
        }
        
        this.dataLoaded = true;
        this.lastFetchTime = Date.now();
        
        return this.pagination;
      } catch (error) {
        console.error("Error fetching processes data:", error.message);
        if (page === 1) {
          this.processes = [];
        }
        this.dataLoaded = false;
        throw error;
      } finally {
        this.isFetching = false;
      }
    },

    /**
     * Load the next page of processes
     * @returns {Promise<Object>} Pagination data
     */
    async loadMoreProcesses() {
      if (!this.pagination.hasMore || this.isFetching) return;
      
      const nextPage = this.pagination.currentPage + 1;
      return this.fetchProcessesData({
        page: nextPage,
        append: true
      });
    },

    /**
     * Fetch a single process by ID.
     * This conserves bandwidth by only getting one process instead of all.
     * 
     * @param {number|string} processId - ID of the process to fetch
     * @returns {Promise<Object>} The process object
     */
    async fetchProcessById(processId) {
      try {
        const response = await get_request(`processes/${processId}/`);
        const processData = response.data;
        
        // Update the process in the local store if it exists
        const existingIndex = this.processes.findIndex(p => p.id == processId);
        if (existingIndex >= 0) {
          this.processes[existingIndex] = processData;
        } else {
          // Add to the processes array if it doesn't exist
          this.processes.push(processData);
        }
        
        return processData;
      } catch (error) {
        console.error(`Error fetching process ID ${processId}:`, error.message);
        throw error;
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
        authority: formData.authority,
        ref: formData.ref,
        subcase: formData.subcase,
        case: formData.case,
        client: formData.client,
        lawyer: formData.lawyer,
        stage: formData.stage,
      };

      try {
        // Create the process
        const response = await create_request("processes/", mainData);
        
        if (response.status === 201) {
          const processId = response.data.id;
          
          // Track activity
          await registerUserActivity(
            ACTION_TYPES.CREATE,
            `Created process for ${formData.plaintiff} vs ${formData.defendant}`
          );
          
          // Upload files if available
          if (formData.files && formData.files.length > 0) {
            await this.uploadFiles(processId, formData.files);
          }
          
          // Reload processes to ensure data is up-to-date
          this.dataLoaded = false;
          await this.init();
          
          return response.status;
        } else {
          console.error("Failed to create process:", response);
          return null;
        }
      } catch (error) {
        console.error("Error in createProcess:", error);
        return null;
      }
    },

    /**
     * Update an existing process and optionally upload new files.
     *
     * This function sends the updated process data to the backend.
     * If new files are provided, it also uploads them and associates them with the process.
     *
     * @param {object} formData - The form data containing updated process details and new files.
     * @returns {number|null} - HTTP status code (200 for success) or null in case of error.
     */
    async updateProcess(formData) {
      const processId = formData.processId;
      const updateData = {
        plaintiff: formData.plaintiff,
        defendant: formData.defendant,
        authority: formData.authority,
        ref: formData.ref,
        subcase: formData.subcase,
        case: formData.case,
        client: formData.client,
        lawyer: formData.lawyer,
      };

      // Add new stage if provided
      if (formData.stage && formData.stage.status) {
        updateData.stage = {
          status: formData.stage.status,
          date: formData.stage.date,
          description: formData.stage.description,
        };
      }

      try {
        // Update the process
        const response = await update_request(`processes/${processId}/`, updateData);
        
        if (response.status === 200) {
          // Track activity
          await registerUserActivity(
            ACTION_TYPES.UPDATE,
            `Updated process for ${formData.plaintiff} vs ${formData.defendant}`
          );
          
          // Upload new files if available
          if (formData.files && formData.files.length > 0) {
            await this.uploadFiles(processId, formData.files);
          }
          
          // Reload processes to ensure data is up-to-date
          this.dataLoaded = false;
          await this.init();
          
          return response.status;
        } else {
          console.error("Failed to update process:", response);
          return null;
        }
      } catch (error) {
        console.error("Error in updateProcess:", error);
        return null;
      }
    },

    /**
     * Upload files for a specific process.
     *
     * This function uploads multiple files one by one, associating each with the specified process ID.
     *
     * @param {number|string} processId - The ID of the process to associate files with.
     * @param {FileList|Array} files - The list of files to upload.
     * @returns {Promise<boolean>} - True if all uploads were successful, false otherwise.
     */
    async uploadFiles(processId, files) {
      try {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("process", processId);

          const uploadResponse = await create_request(
            "process-files/",
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );

          if (uploadResponse.status !== 201) {
            console.error("Failed to upload file:", file.name);
          }
        }
        
        // Track activity for file uploads
        if (files.length > 0) {
          await registerUserActivity(
            ACTION_TYPES.UPLOAD,
            `Uploaded ${files.length} file(s) to process #${processId}`
          );
        }
        
        return true;
      } catch (error) {
        console.error("Error uploading files:", error);
        return false;
      }
    },
  },
});
