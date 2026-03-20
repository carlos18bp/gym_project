import { defineStore } from "pinia";
import {
  get_request,
  create_request,
  update_request,
  delete_request,
} from "../services/request_http";

export const useSecopStore = defineStore("secop", {
  /**
   * Store state.
   * @returns {object} State object.
   */
  state: () => ({
    processes: [],
    currentProcess: null,
    classifications: [],
    alerts: [],
    savedViews: [],
    availableFilters: {
      departments: [],
      procurement_methods: [],
      statuses: [],
      contract_types: [],
      entity_names: [],
      unspsc_codes: [],
    },
    syncStatus: null,
    loading: false,
    error: null,
    pagination: {
      count: 0,
      totalPages: 0,
      currentPage: 1,
      pageSize: 20,
    },
  }),

  getters: {
    /**
     * Get process by ID.
     * @param {object} state - State.
     * @returns {function} - Function to find process by ID.
     */
    processById: (state) => (id) => {
      return state.processes.find((p) => p.id === id);
    },

    /**
     * Get only open processes.
     * @param {object} state - State.
     * @returns {array} - Open processes.
     */
    openProcesses: (state) => {
      return state.processes.filter((p) => p.is_open);
    },

    /**
     * Get processes that the user has classified.
     * @param {object} state - State.
     * @returns {array} - Classified processes.
     */
    classifiedProcesses: (state) => {
      return state.processes.filter((p) => p.my_classification !== null);
    },

    /**
     * Get active alerts count.
     * @param {object} state - State.
     * @returns {number} - Active alerts count.
     */
    activeAlertsCount: (state) => {
      return state.alerts.filter((a) => a.is_active).length;
    },
  },

  actions: {
    // ---------------------------------------------------------------
    // Process actions
    // ---------------------------------------------------------------

    /**
     * Fetch SECOP processes with filtering and pagination.
     * @param {object} params - Query parameters.
     * @returns {object} - Response data.
     */
    async fetchProcesses(params = {}) {
      this.loading = true;
      this.error = null;

      try {
        const queryParams = new URLSearchParams();

        if (params.search) queryParams.append("search", params.search);
        if (params.department) queryParams.append("department", params.department);
        if (params.procurement_method) queryParams.append("procurement_method", params.procurement_method);
        if (params.status) queryParams.append("status", params.status);
        if (params.contract_type) queryParams.append("contract_type", params.contract_type);
        if (params.min_budget) queryParams.append("min_budget", params.min_budget);
        if (params.max_budget) queryParams.append("max_budget", params.max_budget);
        if (params.publication_date_from) queryParams.append("publication_date_from", params.publication_date_from);
        if (params.publication_date_to) queryParams.append("publication_date_to", params.publication_date_to);
        if (params.closing_date_from) queryParams.append("closing_date_from", params.closing_date_from);
        if (params.closing_date_to) queryParams.append("closing_date_to", params.closing_date_to);
        if (params.entity_name) queryParams.append("entity_name", params.entity_name);
        if (params.unspsc_code) queryParams.append("unspsc_code", params.unspsc_code);
        if (params.is_open) queryParams.append("is_open", params.is_open);
        if (params.ordering) queryParams.append("ordering", params.ordering);
        if (params.page) queryParams.append("page", params.page);
        if (params.page_size) queryParams.append("page_size", params.page_size);

        const qs = queryParams.toString();
        const url = `secop/processes/${qs ? "?" + qs : ""}`;
        const response = await get_request(url);

        if (response.status === 200) {
          this.processes = response.data.results;
          this.pagination = {
            count: response.data.count,
            totalPages: response.data.total_pages,
            currentPage: response.data.current_page,
            pageSize: response.data.page_size,
          };
          return response.data;
        }

        throw new Error("Failed to fetch SECOP processes");
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    /**
     * Fetch a single SECOP process detail.
     * @param {number} id - Process ID.
     * @returns {object} - Process data.
     */
    async fetchProcessDetail(id) {
      this.loading = true;
      this.error = null;

      try {
        const response = await get_request(`secop/processes/${id}/`);

        if (response.status === 200) {
          this.currentProcess = response.data;
          return response.data;
        }

        throw new Error("Failed to fetch process detail");
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    /**
     * Fetch processes classified by the current user.
     * @param {string} classificationStatus - Optional status filter.
     * @returns {object} - Response data.
     */
    async fetchMyClassified(classificationStatus = null) {
      this.loading = true;
      this.error = null;

      try {
        const queryParams = new URLSearchParams();
        if (classificationStatus) queryParams.append("classification_status", classificationStatus);

        const qs = queryParams.toString();
        const url = `secop/processes/my-classified/${qs ? "?" + qs : ""}`;
        const response = await get_request(url);

        if (response.status === 200) {
          this.processes = response.data.results;
          this.pagination = {
            count: response.data.count,
            totalPages: response.data.total_pages,
            currentPage: response.data.current_page,
            pageSize: response.data.page_size,
          };
          return response.data;
        }

        throw new Error("Failed to fetch classified processes");
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    // ---------------------------------------------------------------
    // Classification actions
    // ---------------------------------------------------------------

    /**
     * Create or update a classification for a process.
     * @param {object} data - { process, status, notes }
     * @returns {object} - Classification data.
     */
    async createClassification(data) {
      try {
        const response = await create_request("secop/classifications/", data);

        if (response.status === 201) {
          // Update local process data if present
          const process = this.processes.find((p) => p.id === data.process);
          if (process) {
            process.my_classification = response.data;
          }
          if (this.currentProcess && this.currentProcess.id === data.process) {
            // Refresh detail to get updated classifications list
            await this.fetchProcessDetail(data.process);
          }
          return response.data;
        }

        throw new Error("Failed to create classification");
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Delete a classification.
     * @param {number} id - Classification ID.
     * @param {number} processId - Parent process ID.
     */
    async deleteClassification(id, processId) {
      try {
        await delete_request(`secop/classifications/${id}/`);

        // Update local process data
        const process = this.processes.find((p) => p.id === processId);
        if (process) {
          process.my_classification = null;
        }
        if (this.currentProcess && this.currentProcess.id === processId) {
          await this.fetchProcessDetail(processId);
        }
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    // ---------------------------------------------------------------
    // Alert actions
    // ---------------------------------------------------------------

    /**
     * Fetch user's alerts.
     */
    async fetchAlerts() {
      try {
        const response = await get_request("secop/alerts/");
        if (response.status === 200) {
          this.alerts = response.data;
          return response.data;
        }
        throw new Error("Failed to fetch alerts");
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Create a new alert.
     * @param {object} data - Alert data.
     * @returns {object} - Created alert.
     */
    async createAlert(data) {
      try {
        const response = await create_request("secop/alerts/", data);
        if (response.status === 201) {
          this.alerts.unshift(response.data);
          return response.data;
        }
        throw new Error("Failed to create alert");
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Update an existing alert.
     * @param {number} id - Alert ID.
     * @param {object} data - Updated alert data.
     * @returns {object} - Updated alert.
     */
    async updateAlert(id, data) {
      try {
        const response = await update_request(`secop/alerts/${id}/`, data);
        if (response.status === 200) {
          const index = this.alerts.findIndex((a) => a.id === id);
          if (index !== -1) {
            this.alerts[index] = response.data;
          }
          return response.data;
        }
        throw new Error("Failed to update alert");
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Delete an alert.
     * @param {number} id - Alert ID.
     */
    async deleteAlert(id) {
      try {
        await delete_request(`secop/alerts/${id}/`);
        this.alerts = this.alerts.filter((a) => a.id !== id);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Toggle an alert's active status.
     * @param {number} id - Alert ID.
     * @returns {object} - Updated alert.
     */
    async toggleAlert(id) {
      try {
        const response = await create_request(`secop/alerts/${id}/toggle/`, {});
        if (response.status === 200) {
          const index = this.alerts.findIndex((a) => a.id === id);
          if (index !== -1) {
            this.alerts[index] = response.data;
          }
          return response.data;
        }
        throw new Error("Failed to toggle alert");
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    // ---------------------------------------------------------------
    // Saved views actions
    // ---------------------------------------------------------------

    /**
     * Fetch user's saved views.
     */
    async fetchSavedViews() {
      try {
        const response = await get_request("secop/saved-views/");
        if (response.status === 200) {
          this.savedViews = response.data;
          return response.data;
        }
        throw new Error("Failed to fetch saved views");
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Create a new saved view.
     * @param {object} data - { name, filters }
     * @returns {object} - Created saved view.
     */
    async createSavedView(data) {
      try {
        const response = await create_request("secop/saved-views/", data);
        if (response.status === 201) {
          this.savedViews.unshift(response.data);
          return response.data;
        }
        throw new Error("Failed to create saved view");
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Delete a saved view.
     * @param {number} id - Saved view ID.
     */
    async deleteSavedView(id) {
      try {
        await delete_request(`secop/saved-views/${id}/`);
        this.savedViews = this.savedViews.filter((v) => v.id !== id);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    // ---------------------------------------------------------------
    // Filters & Sync actions
    // ---------------------------------------------------------------

    /**
     * Fetch available filter values.
     */
    async fetchAvailableFilters() {
      try {
        const response = await get_request("secop/filters/");
        if (response.status === 200) {
          this.availableFilters = response.data;
          return response.data;
        }
        throw new Error("Failed to fetch filters");
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Fetch sync status.
     */
    async fetchSyncStatus() {
      try {
        const response = await get_request("secop/sync/");
        if (response.status === 200) {
          this.syncStatus = response.data;
          return response.data;
        }
        throw new Error("Failed to fetch sync status");
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Trigger manual sync.
     */
    async triggerSync() {
      try {
        const response = await create_request("secop/sync/trigger/", {});
        return response.data;
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Export filtered processes to Excel.
     * @param {object} params - Filter parameters.
     */
    async exportExcel(params = {}) {
      try {
        const queryParams = new URLSearchParams();
        if (params.search) queryParams.append("search", params.search);
        if (params.department) queryParams.append("department", params.department);
        if (params.procurement_method) queryParams.append("procurement_method", params.procurement_method);
        if (params.status) queryParams.append("status", params.status);
        if (params.entity_name) queryParams.append("entity_name", params.entity_name);
        if (params.unspsc_code) queryParams.append("unspsc_code", params.unspsc_code);
        if (params.min_budget) queryParams.append("min_budget", params.min_budget);
        if (params.max_budget) queryParams.append("max_budget", params.max_budget);
        if (params.publication_date_from) queryParams.append("publication_date_from", params.publication_date_from);
        if (params.publication_date_to) queryParams.append("publication_date_to", params.publication_date_to);
        if (params.closing_date_from) queryParams.append("closing_date_from", params.closing_date_from);
        if (params.closing_date_to) queryParams.append("closing_date_to", params.closing_date_to);
        if (params.ordering) queryParams.append("ordering", params.ordering);

        const qs = queryParams.toString();
        const url = `secop/export/${qs ? "?" + qs : ""}`;
        const response = await get_request(url, "blob");

        // Create download link
        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const link = document.createElement("a");
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = `secop_export_${new Date().toISOString().split("T")[0]}.xlsx`;
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },
  },
});
