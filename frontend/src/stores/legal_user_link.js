import { defineStore } from "pinia";
import { get_request } from "./services/request_http";

export const useLegalUserLinkStore = defineStore("legalUserLink", {
  /**
   * Store state.
   */
  state: () => ({
    legalUserLinks: [], // Array to store legal user links
    dataLoaded: false, // Flag to check if data has been loaded
  }),

  /**
   * Store actions.
   */
  actions: {
    /**
     * Fetch legal user links for a specific user from the backend.
     * @param {number} userId - The ID of the user.
     */
    async fetchLegalUserLinks(userId) {
      try {
        const response = await get_request(`/users/${userId}/legal-links/`);
        this.legalUserLinks = response.data;
        this.dataLoaded = true;
      } catch (error) {
        console.error("Error fetching legal user links:", error);
        this.legalUserLinks = [];
        this.dataLoaded = false;
      }
    },
  },
});
