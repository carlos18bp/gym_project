import { defineStore } from "pinia";
import { get_request, create_request } from "./services/request_http";

export const useRecentProcessStore = defineStore("recentProcess", {
  state: () => ({
    recentProcesses: [],
    isLoading: false,
  }),

  actions: {
    /**
     * Initialize store by fetching data
     */
    async init() {
      await this.fetchRecentProcesses();
    },

    /**
     * Fetch recent processes from backend.
     * This method includes a loading state to prevent multiple simultaneous calls
     */
    async fetchRecentProcesses() {
      if (this.isLoading) return; // Prevent multiple simultaneous calls
      
      try {
        this.isLoading = true;
        const response = await get_request("recent-processes/");
        this.recentProcesses = response.data;
      } catch (error) {
        console.error("Error fetching recent processes:", error);
        this.recentProcesses = [];
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Update recent process when viewed and refresh the list
     * @param {number} processId - The ID of the process being viewed
     */
    async updateRecentProcess(processId) {
      try {
        await create_request(`update-recent-process/${processId}/`);
        await this.fetchRecentProcesses(); // Refresh the list after updating
      } catch (error) {
        console.error("Error updating recent process:", error);
      }
    },
  },
}); 